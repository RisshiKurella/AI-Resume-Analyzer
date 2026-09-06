import { useState } from "react";
import { jsPDF } from "jspdf";
import "./App.css";

function App() {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [jobDescription, setJobDescription] = useState("");
  const [jobResult, setJobResult] = useState(null);

  const [loading, setLoading] = useState(false);
  const [jobLoading, setJobLoading] = useState(false);

  const [error, setError] = useState("");
  const [jobError, setJobError] = useState("");

  // ============================================================
  // SAFE RENDER FUNCTION
  // ============================================================

  const renderValue = (value) => {
    if (value === null || value === undefined) {
      return "";
    }

    if (typeof value === "string" || typeof value === "number") {
      return String(value);
    }

    if (Array.isArray(value)) {
      return value.map((item, index) => (
        <span key={index}>
          {renderValue(item)}
          {index < value.length - 1 ? ", " : ""}
        </span>
      ));
    }

    if (typeof value === "object") {
      return (
        <div className="object-content">
          {Object.entries(value).map(([key, val]) => (
            <div key={key} className="object-row">
              <strong>
                {key
                  .replace(/_/g, " ")
                  .replace(/\b\w/g, (letter) => letter.toUpperCase())}
                :
              </strong>{" "}
              {renderValue(val)}
            </div>
          ))}
        </div>
      );
    }

    return String(value);
  };

  // ============================================================
  // SCORE INTERPRETATION
  // ============================================================

  const getScoreStatus = (score) => {
    const numericScore = Number(score) || 0;

    if (numericScore >= 85) {
      return {
        label: "Excellent Resume",
        shortLabel: "Excellent",
        className: "excellent",
        message: "Your resume is highly ATS-friendly and well aligned with common hiring requirements.",
      };
    }

    if (numericScore >= 70) {
      return {
        label: "Good Resume",
        shortLabel: "Good",
        className: "good",
        message: "Your resume has a strong foundation, with a few areas that can still be improved.",
      };
    }

    if (numericScore >= 50) {
      return {
        label: "Average Resume",
        shortLabel: "Average",
        className: "average",
        message: "Your resume is on the right track, but improving keywords, skills, and content can increase its ATS score.",
      };
    }

    return {
      label: "Needs Improvement",
      shortLabel: "Needs Improvement",
      className: "needs-improvement",
      message: "Your resume needs significant improvements to become more ATS-friendly and competitive.",
    };
  };

  // ============================================================
  // FILE SELECT
  // ============================================================

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];

    if (!selectedFile) {
      return;
    }

    setFile(selectedFile);
    setResult(null);
    setJobResult(null);
    setError("");
    setJobError("");
  };

  // ============================================================
  // RESUME ANALYSIS
  // ============================================================

  const analyzeResume = async () => {
    if (!file) {
      setError("Please select a resume first.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/analyze-resume",
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Resume analysis failed.");
      }

      setResult(data.analysis);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // JOB MATCHING
  // ============================================================

  const matchJob = async () => {
    if (!file) {
      setJobError("Please upload your resume first.");
      return;
    }

    if (!jobDescription.trim()) {
      setJobError("Please enter a job description.");
      return;
    }

    setJobLoading(true);
    setJobError("");
    setJobResult(null);

    const formData = new FormData();

    formData.append("file", file);
    formData.append("job_description", jobDescription);

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/match-job",
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Job matching failed.");
      }

      setJobResult(data.analysis);
    } catch (err) {
      setJobError(err.message);
    } finally {
      setJobLoading(false);
    }
  };

  // ============================================================
  // PROFESSIONAL PDF REPORT
  // ============================================================

  const valueToPDFText = (value) => {
    if (value === null || value === undefined) return "";

    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return String(value)
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2013\u2014]/g, "-")
        .replace(/\u2026/g, "...");
    }

    if (Array.isArray(value)) {
      return value.map((item) => valueToPDFText(item)).filter(Boolean).join("; ");
    }

    if (typeof value === "object") {
      return Object.entries(value)
        .map(([key, val]) => `${key.replace(/_/g, " ")}: ${valueToPDFText(val)}`)
        .join(" | ");
    }

    return String(value);
  };

  const downloadPDFReport = () => {
    if (!result) return;

    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 16;
    const contentWidth = pageWidth - margin * 2;
    let y = 16;

    const score = Math.max(0, Math.min(100, Number(result.ats_score) || 0));
    const status = getScoreStatus(score);

    const addPageIfNeeded = (height = 12) => {
      if (y + height > pageHeight - 18) {
        doc.addPage();
        y = 18;
        drawPageHeader();
      }
    };

    const drawPageHeader = () => {
      if (doc.getNumberOfPages() > 1) {
        doc.setFillColor(23, 32, 51);
        doc.rect(0, 0, pageWidth, 7, "F");
      }
    };

    const addSectionTitle = (title) => {
      addPageIfNeeded(14);
      doc.setFillColor(79, 70, 229);
      doc.roundedRect(margin, y - 5, 3, 9, 1, 1, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(23, 32, 51);
      doc.text(title, margin + 7, y + 2);
      y += 11;
    };

    const addParagraph = (text, options = {}) => {
      const value = valueToPDFText(text);
      if (!value) return;

      const fontSize = options.fontSize || 10;
      const lineHeight = options.lineHeight || 5.2;
      const lines = doc.splitTextToSize(value, contentWidth - (options.indent || 0));

      doc.setFont("helvetica", options.bold ? "bold" : "normal");
      doc.setFontSize(fontSize);
      if (options.color !== undefined) {
        doc.setTextColor(options.color);
      } else {
        doc.setTextColor(75, 85, 99);
      }

      for (const line of lines) {
        addPageIfNeeded(lineHeight + 2);
        doc.text(line, margin + (options.indent || 0), y);
        y += lineHeight;
      }
      y += options.after !== undefined ? options.after : 2;
    };

    const addBulletList = (items) => {
      if (!Array.isArray(items) || items.length === 0) {
        addParagraph("No information provided.", { color: 107, after: 4 });
        return;
      }

      items.forEach((item) => {
        const text = valueToPDFText(item);
        if (!text) return;
        const lines = doc.splitTextToSize(text, contentWidth - 8);
        for (let i = 0; i < lines.length; i += 1) {
          addPageIfNeeded(5.2 + 2);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(10);
          doc.setTextColor(55, 65, 81);
          doc.text(i === 0 ? "-" : "", margin + 1, y);
          doc.text(lines[i], margin + 6, y);
          y += 5.2;
        }
        y += 1.5;
      });
      y += 2;
    };

    const addTagLine = (items) => {
      const values = Array.isArray(items)
        ? items.map(valueToPDFText).filter(Boolean)
        : [];

      if (values.length === 0) {
        addParagraph("None listed.", { color: 107 });
        return;
      }

      addParagraph(values.join("  |  "), { color: 55, after: 4 });
    };

    // Cover/header
    doc.setFillColor(23, 32, 51);
    doc.rect(0, 0, pageWidth, 38, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(255, 255, 255);
    doc.text("AI Resume Analyzer", margin, 17);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(218, 224, 235);
    doc.text("Professional Resume Analysis Report", margin, 25);

    doc.setFontSize(8.5);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - margin, 25, { align: "right" });

    y = 49;

    // File information
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(75, 85, 99);
    doc.text("RESUME", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(23, 32, 51);
    doc.text(valueToPDFText(file?.name || "Uploaded Resume"), margin, y);
    y += 10;

    // ATS score block
    addPageIfNeeded(43);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, y, contentWidth, 35, 4, 4, "F");
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, y, contentWidth, 35, 4, 4, "S");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text("ATS SCORE", margin + 8, y + 9);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(26);
    doc.setTextColor(79, 70, 229);
    doc.text(`${score}/100`, margin + 8, y + 22);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(23, 32, 51);
    doc.text(valueToPDFText(result.overall_rating || status.label), margin + 55, y + 11);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(75, 85, 99);
    const statusLines = doc.splitTextToSize(status.message, contentWidth - 65);
    doc.text(statusLines.slice(0, 3), margin + 55, y + 18);
    y += 44;

    addSectionTitle("Resume Summary");
    addParagraph(result.summary || "No summary provided.");

    addSectionTitle("Technical Skills");
    addTagLine(result.technical_skills);

    addSectionTitle("Soft Skills");
    addTagLine(result.soft_skills);

    addSectionTitle("Strengths");
    addBulletList(result.strengths);

    addSectionTitle("Weaknesses");
    addBulletList(result.weaknesses);

    addSectionTitle("Missing Skills");
    addTagLine(result.missing_skills);

    addSectionTitle("Improvement Suggestions");
    addBulletList(result.improvement_suggestions);

    addSectionTitle("Recommended Job Roles");
    addBulletList(result.recommended_roles);

    addSectionTitle("Education");
    addBulletList(result.education);

    addSectionTitle("Experience");
    addBulletList(result.experience);

    if (jobResult) {
      addSectionTitle("Job Match Analysis");

      addPageIfNeeded(35);
      doc.setFillColor(240, 253, 244);
      doc.roundedRect(margin, y, contentWidth, 28, 4, 4, "F");
      doc.setDrawColor(187, 247, 208);
      doc.roundedRect(margin, y, contentWidth, 28, 4, 4, "S");

      const jobScore = Math.max(0, Math.min(100, Number(jobResult.match_score) || 0));
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(22, 101, 52);
      doc.text(`${jobScore}/100`, margin + 8, y + 18);

      doc.setFontSize(12);
      doc.setTextColor(23, 32, 51);
      doc.text("Job Match Score", margin + 45, y + 9);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(75, 85, 99);
      const fitLines = doc.splitTextToSize(valueToPDFText(jobResult.fit_summary || ""), contentWidth - 55);
      doc.text(fitLines.slice(0, 3), margin + 45, y + 16);
      y += 37;

      addSectionTitle("Matching Skills");
      addTagLine(jobResult.matching_skills);

      addSectionTitle("Missing Job Skills");
      addTagLine(jobResult.missing_skills);

      addSectionTitle("Matching Keywords");
      addTagLine(jobResult.matching_keywords);

      addSectionTitle("Missing Keywords");
      addTagLine(jobResult.missing_keywords);

      addSectionTitle("Strengths for This Job");
      addBulletList(jobResult.strengths_for_job);

      addSectionTitle("Weaknesses for This Job");
      addBulletList(jobResult.weaknesses_for_job);

      addSectionTitle("Job Recommendations");
      addBulletList(jobResult.recommendations);
    }

    // Footer on every page
    const totalPages = doc.getNumberOfPages();
    for (let page = 1; page <= totalPages; page += 1) {
      doc.setPage(page);
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, pageHeight - 13, pageWidth - margin, pageHeight - 13);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(107, 114, 128);
      doc.text("AI Resume Analyzer", margin, pageHeight - 7);
      doc.text(`Page ${page} of ${totalPages}`, pageWidth - margin, pageHeight - 7, { align: "right" });
    }

    const safeName = (file?.name || "Resume")
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "") || "Resume";

    doc.save(`${safeName}_AI_Resume_Report.pdf`);
  };

  // ============================================================
  // UI
  // ============================================================

  return (
    <div className="app">

      {/* HEADER */}
      <header className="header">
        <div className="logo">
          🤖 AI Resume Analyzer
        </div>

        <div className="header-badge">
          AI Powered
        </div>
      </header>


      {/* MAIN */}
      <main className="container">

        {/* HERO */}
        <section className="hero">
          <h1>
            Analyze Your Resume with AI
          </h1>

          <p>
            Get an ATS score, identify your strengths and weaknesses,
            discover missing skills, and match your resume with job
            descriptions.
          </p>
        </section>


        {/* RESUME UPLOAD */}
        <section className="upload-card">

          <h2>📄 Upload Your Resume</h2>

          <p className="upload-description">
            Upload your resume in PDF or DOCX format.
          </p>

          <label className="file-button">
            Choose Resume

            <input
              type="file"
              accept=".pdf,.docx"
              onChange={handleFileChange}
            />
          </label>

          {file && (
            <div className="selected-file">
              📎 {file.name}
            </div>
          )}

          <button
            className="analyze-button"
            onClick={analyzeResume}
            disabled={loading}
          >
            {loading ? "Analyzing Resume..." : "Analyze Resume"}
          </button>

          {error && (
            <div className="error">
              ❌ {error}
            </div>
          )}

        </section>


        {/* ====================================================
            RESUME ANALYSIS RESULTS
        ==================================================== */}

        {result && (
          <section className="results">

            {/* ATS SCORE */}
            <div className={`score-card ${getScoreStatus(result.ats_score).className}`}>

              <div
                className="score-circle"
                style={{
                  "--score": `${Math.max(0, Math.min(100, Number(result.ats_score) || 0)) * 3.6}deg`,
                }}
              >
                <div className="score-inner">

                  <span className="score-number">
                    {result.ats_score}
                  </span>

                  <span className="score-label">
                    ATS SCORE
                  </span>

                </div>
              </div>


              <div className="score-info">

                <div className="score-heading-row">
                  <h2>ATS Score</h2>
                  <span className={`score-status ${getScoreStatus(result.ats_score).className}`}>
                    {getScoreStatus(result.ats_score).shortLabel}
                  </span>
                </div>

                <h3>
                  {result.overall_rating || getScoreStatus(result.ats_score).label}
                </h3>

                <p>
                  {getScoreStatus(result.ats_score).message}
                </p>

              </div>

            </div>


            {/* PDF REPORT */}
            <div className="pdf-button-container">
              <button
                className="pdf-button"
                onClick={downloadPDFReport}
              >
                Download Professional PDF Report
              </button>
            </div>


            {/* SUMMARY */}
            <div className="result-card">

              <h2>📝 Resume Summary</h2>

              <p>
                {result.summary}
              </p>

            </div>


            {/* SKILLS */}
            <div className="grid">

              <div className="result-card">

                <h2>💻 Technical Skills</h2>

                <div className="tags">

                  {result.technical_skills?.map(
                    (skill, index) => (
                      <span
                        className="tag"
                        key={index}
                      >
                        {renderValue(skill)}
                      </span>
                    )
                  )}

                </div>

              </div>


              <div className="result-card">

                <h2>🤝 Soft Skills</h2>

                <div className="tags">

                  {result.soft_skills?.map(
                    (skill, index) => (
                      <span
                        className="tag"
                        key={index}
                      >
                        {renderValue(skill)}
                      </span>
                    )
                  )}

                </div>

              </div>

            </div>


            {/* STRENGTHS / WEAKNESSES */}
            <div className="grid">

              <div className="result-card strengths-card">

                <h2>💪 Strengths</h2>

                <ul>

                  {result.strengths?.map(
                    (item, index) => (
                      <li key={index}>
                        {renderValue(item)}
                      </li>
                    )
                  )}

                </ul>

              </div>


              <div className="result-card weaknesses-card">

                <h2>⚠️ Weaknesses</h2>

                <ul>

                  {result.weaknesses?.map(
                    (item, index) => (
                      <li key={index}>
                        {renderValue(item)}
                      </li>
                    )
                  )}

                </ul>

              </div>

            </div>


            {/* MISSING SKILLS */}
            <div className="result-card missing-card">

              <h2>🎯 Missing Skills</h2>

              <div className="tags">

                {result.missing_skills?.map(
                  (skill, index) => (
                    <span
                      className="tag missing-tag"
                      key={index}
                    >
                      {renderValue(skill)}
                    </span>
                  )
                )}

              </div>

            </div>


            {/* IMPROVEMENTS */}
            <div className="result-card">

              <h2>💡 Improvement Suggestions</h2>

              <ul>

                {result.improvement_suggestions?.map(
                  (item, index) => (
                    <li key={index}>
                      {renderValue(item)}
                    </li>
                  )
                )}

              </ul>

            </div>


            {/* RECOMMENDED ROLES */}
            <div className="result-card">

              <h2>🚀 Recommended Job Roles</h2>

              <div className="roles">

                {result.recommended_roles?.map(
                  (role, index) => (
                    <div
                      className="role"
                      key={index}
                    >
                      {renderValue(role)}
                    </div>
                  )
                )}

              </div>

            </div>


            {/* EDUCATION */}
            <div className="result-card">

              <h2>🎓 Education</h2>

              {result.education?.map(
                (item, index) => (
                  <div
                    className="detail-item"
                    key={index}
                  >
                    {renderValue(item)}
                  </div>
                )
              )}

            </div>


            {/* EXPERIENCE */}
            <div className="result-card">

              <h2>💼 Experience</h2>

              {result.experience?.map(
                (item, index) => (
                  <div
                    className="detail-item"
                    key={index}
                  >
                    {renderValue(item)}
                  </div>
                )
              )}

            </div>

          </section>
        )}


        {/* ====================================================
            JOB MATCHER
        ==================================================== */}

        <section className="job-matcher">

          <div className="job-header">

            <h2>
              🎯 Job Description Matcher
            </h2>

            <p>
              Find out how well your resume matches a specific job.
            </p>

          </div>


          <div className="job-card">

            <label htmlFor="jobDescription">
              Paste Job Description
            </label>

            <textarea
              id="jobDescription"
              value={jobDescription}
              onChange={(e) =>
                setJobDescription(e.target.value)
              }
              placeholder={`Paste the job description here...

Example:

We are looking for a Cyber Security Intern.

Requirements:
- Python
- Linux
- Networking
- Cyber Security
- Vulnerability Assessment
- Problem Solving`}
              rows="12"
            />


            <button
              className="match-button"
              onClick={matchJob}
              disabled={jobLoading}
            >
              {jobLoading
                ? "Matching Resume..."
                : "🔍 Match Resume to Job"}
            </button>


            {jobError && (
              <div className="error">
                ❌ {jobError}
              </div>
            )}

          </div>


          {/* JOB MATCH RESULTS */}
          {jobResult && (
            <div className="job-results">

              {/* MATCH SCORE */}
              <div className="match-score-card">

                <div
                  className="match-score"
                  style={{
                    "--match-score": `${jobResult.match_score * 3.6}deg`,
                  }}
                >
                  <div className="match-score-inner">

                    <span>
                      {jobResult.match_score}
                    </span>

                    <small>
                      MATCH
                    </small>

                  </div>
                </div>


                <div>

                  <h2>
                    Job Match Score
                  </h2>

                  <p>
                    {jobResult.fit_summary}
                  </p>

                </div>

              </div>


              {/* MATCHING / MISSING SKILLS */}
              <div className="grid">

                <div className="result-card matching-card">

                  <h2>
                    ✅ Matching Skills
                  </h2>

                  <div className="tags">

                    {jobResult.matching_skills?.map(
                      (skill, index) => (
                        <span
                          className="tag"
                          key={index}
                        >
                          {renderValue(skill)}
                        </span>
                      )
                    )}

                  </div>

                </div>


                <div className="result-card missing-card">

                  <h2>
                    ❌ Missing Skills
                  </h2>

                  <div className="tags">

                    {jobResult.missing_skills?.map(
                      (skill, index) => (
                        <span
                          className="tag missing-tag"
                          key={index}
                        >
                          {renderValue(skill)}
                        </span>
                      )
                    )}

                  </div>

                </div>

              </div>


              {/* KEYWORDS */}
              <div className="grid">

                <div className="result-card">

                  <h2>
                    🔑 Matching Keywords
                  </h2>

                  <div className="tags">

                    {jobResult.matching_keywords?.map(
                      (keyword, index) => (
                        <span
                          className="tag"
                          key={index}
                        >
                          {renderValue(keyword)}
                        </span>
                      )
                    )}

                  </div>

                </div>


                <div className="result-card">

                  <h2>
                    🔍 Missing Keywords
                  </h2>

                  <div className="tags">

                    {jobResult.missing_keywords?.map(
                      (keyword, index) => (
                        <span
                          className="tag missing-tag"
                          key={index}
                        >
                          {renderValue(keyword)}
                        </span>
                      )
                    )}

                  </div>

                </div>

              </div>


              {/* STRENGTHS / WEAKNESSES */}
              <div className="grid">

                <div className="result-card strengths-card">

                  <h2>
                    💪 Strengths for This Job
                  </h2>

                  <ul>

                    {jobResult.strengths_for_job?.map(
                      (item, index) => (
                        <li key={index}>
                          {renderValue(item)}
                        </li>
                      )
                    )}

                  </ul>

                </div>


                <div className="result-card weaknesses-card">

                  <h2>
                    ⚠️ Weaknesses for This Job
                  </h2>

                  <ul>

                    {jobResult.weaknesses_for_job?.map(
                      (item, index) => (
                        <li key={index}>
                          {renderValue(item)}
                        </li>
                      )
                    )}

                  </ul>

                </div>

              </div>


              {/* RECOMMENDATIONS */}
              <div className="result-card">

                <h2>
                  💡 Recommendations
                </h2>

                <ul>

                  {jobResult.recommendations?.map(
                    (item, index) => (
                      <li key={index}>
                        {renderValue(item)}
                      </li>
                    )
                  )}

                </ul>

              </div>


              {/* FIT SUMMARY */}
              <div className="result-card fit-summary">

                <h2>
                  📊 Overall Job Fit
                </h2>

                <p>
                  {jobResult.fit_summary}
                </p>

              </div>

            </div>
          )}

        </section>

      </main>


      {/* FOOTER */}
      <footer>

        <p>
          AI Resume Analyzer • Built with React, FastAPI & AI
        </p>

      </footer>

    </div>
  );
}

export default App;