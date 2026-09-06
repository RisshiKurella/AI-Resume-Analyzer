import os
import io
import json
import re

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pypdf import PdfReader
from docx import Document
from dotenv import load_dotenv
from openai import OpenAI


# ============================================================
# LOAD ENVIRONMENT VARIABLES
# ============================================================

load_dotenv()

# Create OpenAI client
api_key = os.getenv("OPENAI_API_KEY")

if not api_key:
    print("WARNING: OPENAI_API_KEY is not loaded.")
else:
    print("API KEY LOADED: True")

client = OpenAI(api_key=api_key)


# ============================================================
# FASTAPI APP
# ============================================================

app = FastAPI(
    title="AI Resume Analyzer",
    description="An AI-powered application that analyzes resumes.",
    version="1.0.0"
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# HOME
# ============================================================

@app.get("/")
def home():
    return {
        "message": "AI Resume Analyzer API is running!"
    }


# ============================================================
# RESUME TEXT EXTRACTION
# ============================================================

async def extract_resume_text(file: UploadFile):

    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="No file selected"
        )

    filename = file.filename.lower()

    try:

        # ----------------------------------------------------
        # Read uploaded file
        # ----------------------------------------------------

        contents = await file.read()

        # ----------------------------------------------------
        # PDF
        # ----------------------------------------------------

        if filename.endswith(".pdf"):

            reader = PdfReader(io.BytesIO(contents))

            text = ""

            for page in reader.pages:

                extracted = page.extract_text()

                if extracted:
                    text += extracted + "\n"

        # ----------------------------------------------------
        # DOCX
        # ----------------------------------------------------

        elif filename.endswith(".docx"):

            document = Document(io.BytesIO(contents))

            text = ""

            for paragraph in document.paragraphs:

                if paragraph.text.strip():
                    text += paragraph.text + "\n"

        # ----------------------------------------------------
        # UNSUPPORTED FILE
        # ----------------------------------------------------

        else:

            raise HTTPException(
                status_code=400,
                detail="Unsupported file type. Please upload a PDF or DOCX file."
            )

        return text.strip()

    except HTTPException:
        raise

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=f"Could not extract resume: {str(e)}"
        )


# ============================================================
# EXTRACT RESUME ENDPOINT
# ============================================================

@app.post("/extract-resume")
async def extract_resume(file: UploadFile = File(...)):

    text = await extract_resume_text(file)

    return {
        "filename": file.filename,
        "text": text
    }


# ============================================================
# AI RESUME ANALYSIS
# ============================================================

@app.post("/analyze-resume")
async def analyze_resume(file: UploadFile = File(...)):

    # --------------------------------------------------------
    # Check API key
    # --------------------------------------------------------

    if not api_key:

        raise HTTPException(
            status_code=500,
            detail="OPENAI_API_KEY is not configured. Check your .env file."
        )

    # --------------------------------------------------------
    # Extract resume text
    # --------------------------------------------------------

    resume_text = await extract_resume_text(file)

    if not resume_text:

        raise HTTPException(
            status_code=400,
            detail="Could not extract any text from the resume."
        )

    # --------------------------------------------------------
    # AI Prompt
    # --------------------------------------------------------

    prompt = f"""
You are an expert AI Resume Analyzer and ATS (Applicant Tracking System) specialist.

Analyze the following resume carefully.

RESUME:
----------------
{resume_text}
----------------

Return ONLY valid JSON.

The JSON must contain exactly these fields:

{{
    "ats_score": 0,
    "overall_rating": "",
    "summary": "",
    "technical_skills": [],
    "soft_skills": [],
    "education": [],
    "experience": [],
    "strengths": [],
    "weaknesses": [],
    "missing_skills": [],
    "improvement_suggestions": [],
    "recommended_roles": []
}}

Instructions:

1. ats_score:
   Give an ATS score from 0 to 100.

2. overall_rating:
   Give a short rating such as:
   "Excellent", "Very Good", "Good", "Average", or "Needs Improvement".

3. summary:
   Give a concise summary of the candidate's profile.

4. technical_skills:
   List the technical skills found in the resume.

5. soft_skills:
   List the soft skills found in the resume.

6. education:
   List the candidate's educational qualifications.

7. experience:
   Summarize internships, jobs, projects, or other relevant experience.

8. strengths:
   List the strongest aspects of the resume.

9. weaknesses:
   List weaknesses or areas that could be improved.

10. missing_skills:
    Identify important skills that appear to be missing based on the candidate's profile.

11. improvement_suggestions:
    Give practical suggestions to improve the resume and increase ATS performance.

12. recommended_roles:
    Recommend suitable job roles based on the candidate's skills,
    education, projects, and experience.

Do not invent information that is not present in the resume.
"""

    # --------------------------------------------------------
    # Send resume to OpenAI
    # --------------------------------------------------------

    try:

        response = client.responses.create(
            model="gpt-5.6-luna",
            input=prompt
        )

        ai_result = response.output_text

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=f"AI analysis failed: {str(e)}"
        )

    # --------------------------------------------------------
    # Convert AI response to JSON
    # --------------------------------------------------------

    try:

        ai_result = ai_result.strip()

        # Remove Markdown code fences if AI added them
        ai_result = re.sub(
            r"^```json\s*",
            "",
            ai_result,
            flags=re.IGNORECASE
        )

        ai_result = re.sub(
            r"^```\s*",
            "",
            ai_result
        )

        ai_result = re.sub(
            r"\s*```$",
            "",
            ai_result
        )

        ai_result = ai_result.strip()

        # Find JSON object
        start = ai_result.find("{")
        end = ai_result.rfind("}")

        if start == -1 or end == -1:

            raise ValueError(
                "No JSON object found in AI response."
            )

        json_text = ai_result[start:end + 1]

        analysis = json.loads(json_text)

    except (json.JSONDecodeError, ValueError) as e:

        print("========================================")
        print("AI JSON PARSING ERROR")
        print("========================================")
        print("Raw AI response:")
        print(ai_result)
        print("========================================")

        raise HTTPException(
            status_code=500,
            detail=f"AI returned an invalid JSON response: {str(e)}"
        )

    # --------------------------------------------------------
    # Return result
    # --------------------------------------------------------

    return {
        "filename": file.filename,
        "analysis": analysis
    }


# ============================================================
# JOB DESCRIPTION MATCHER
# ============================================================

@app.post("/match-job")
async def match_job(
    file: UploadFile = File(...),
    job_description: str = Form(...)
):

    # --------------------------------------------------------
    # Check API key
    # --------------------------------------------------------

    if not api_key:

        raise HTTPException(
            status_code=500,
            detail="OPENAI_API_KEY is not configured. Check your .env file."
        )

    # --------------------------------------------------------
    # Check job description
    # --------------------------------------------------------

    if not job_description.strip():

        raise HTTPException(
            status_code=400,
            detail="Please provide a job description."
        )

    # --------------------------------------------------------
    # Extract resume text
    # --------------------------------------------------------

    resume_text = await extract_resume_text(file)

    if not resume_text:

        raise HTTPException(
            status_code=400,
            detail="Could not extract any text from the resume."
        )

    # --------------------------------------------------------
    # AI Job Matching Prompt
    # --------------------------------------------------------

    prompt = f"""
You are an expert ATS resume and job matching system.

Your task is to compare a candidate's resume with a specific job description.

========================
RESUME
========================

{resume_text}


========================
JOB DESCRIPTION
========================

{job_description}


========================
TASK
========================

Analyze how well the candidate's resume matches this specific job.

Return ONLY valid JSON.

Use exactly this structure:

{{
    "match_score": 0,
    "matching_skills": [],
    "missing_skills": [],
    "matching_keywords": [],
    "missing_keywords": [],
    "strengths_for_job": [],
    "weaknesses_for_job": [],
    "recommendations": [],
    "fit_summary": ""
}}

Rules:

1. match_score:
   Give a job match score from 0 to 100.

2. matching_skills:
   List important skills that are present in both the resume
   and the job description.

3. missing_skills:
   List important skills required by the job description
   that are not clearly present in the resume.

4. matching_keywords:
   List important ATS keywords that appear in both
   the resume and job description.

5. missing_keywords:
   List important keywords from the job description
   that are missing from the resume.

6. strengths_for_job:
   Explain the strongest parts of the candidate's resume
   for this particular job.

7. weaknesses_for_job:
   Explain the main weaknesses of the resume
   when compared with this job.

8. recommendations:
   Give practical suggestions for modifying the resume
   specifically for this job.

9. fit_summary:
   Give a concise explanation of how well the candidate
   fits the job.

IMPORTANT:

- Do not invent skills.
- Do not invent work experience.
- Do not claim that the candidate has a skill unless it
  appears in the resume.
- Focus specifically on the supplied job description.
- Return ONLY valid JSON.
"""

    # --------------------------------------------------------
    # Send request to OpenAI
    # --------------------------------------------------------

    try:

        response = client.responses.create(
            model="gpt-5.6-luna",
            input=prompt
        )

        ai_result = response.output_text

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=f"AI job matching failed: {str(e)}"
        )

    # --------------------------------------------------------
    # Convert AI response to JSON
    # --------------------------------------------------------

    try:

        ai_result = ai_result.strip()

        # Remove Markdown code fences
        ai_result = re.sub(
            r"^```json\s*",
            "",
            ai_result,
            flags=re.IGNORECASE
        )

        ai_result = re.sub(
            r"^```\s*",
            "",
            ai_result
        )

        ai_result = re.sub(
            r"\s*```$",
            "",
            ai_result
        )

        ai_result = ai_result.strip()

        # Find JSON object
        start = ai_result.find("{")
        end = ai_result.rfind("}")

        if start == -1 or end == -1:

            raise ValueError(
                "No JSON object found in AI response."
            )

        json_text = ai_result[start:end + 1]

        analysis = json.loads(json_text)

    except (json.JSONDecodeError, ValueError) as e:

        print("========================================")
        print("JOB MATCH JSON PARSING ERROR")
        print("========================================")
        print("Raw AI response:")
        print(ai_result)
        print("========================================")

        raise HTTPException(
            status_code=500,
            detail=f"AI returned an invalid JSON response: {str(e)}"
        )

    # --------------------------------------------------------
    # Return job match result
    # --------------------------------------------------------

    return {
        "filename": file.filename,
        "analysis": analysis
    }