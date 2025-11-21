require("dotenv").config();
const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const JUDGE0_HOST = process.env.JUDGE0_HOST;
const JUDGE0_KEY = process.env.JUDGE0_KEY;

// Forward request to Judge0
async function forwardToJudge0(source_code, language_id, stdin = "") {
  const r = await fetch(
    `https://${JUDGE0_HOST}/submissions?base64_encoded=false&wait=true`,
    {
      method: "POST",
      headers: {
        "X-RapidAPI-Key": JUDGE0_KEY,
        "X-RapidAPI-Host": JUDGE0_HOST,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ source_code, language_id, stdin }),
    }
  );
  return r.json();
}

// Compile endpoint
app.post("/compile", async (req, res) => {
  try {
    const { source_code, language_id, stdin } = req.body;

    if (!source_code || !language_id) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const judge = await forwardToJudge0(source_code, language_id, stdin || "");

    res.json({
      stdout: judge.stdout || "",
      stderr: judge.stderr || judge.compile_output || "",
      compile_output: judge.compile_output || ""
    });

  } catch (err) {
    console.log("Compile ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});


// Submit result endpoint (only compile check)
app.post("/submit-result", async (req, res) => {
  try {
    const { source_code, expectedOutput, language_id } = req.body;

    const judge = await forwardToJudge0(source_code, language_id, "");

    const stdout = (judge.stdout || "").trim();
    const stderr = judge.stderr || judge.compile_output || "";

    if (stderr) {
      return res.json({ ok: false, reason: "Error", stderr });
    }

    const normalize = (s) =>
      s.replace(/\r/g, "").trim().replace(/\s+/g, " ");

    if (normalize(stdout) === normalize(expectedOutput)) {
      return res.json({ ok: true, passed: true });
    }

    return res.json({
      ok: false,
      reason: "Wrong output",
      expected: expectedOutput,
      actual: stdout,
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
