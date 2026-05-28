import { useState, useRef } from "react";
import "./App.css";

export default function App() {
  const [image, setImage] = useState(null); // { src, base64, type }
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [log, setLog] = useState([]);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef();
  const changeRef = useRef();

  function handleFile(file) {
    if (!file || !file.type.startsWith("image/")) return;
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    const mediaType = allowed.includes(file.type) ? file.type : "image/jpeg";
    const reader = new FileReader();
    reader.onload = (e) => {
      setImage({ src: e.target.result, base64: e.target.result.split(",")[1], type: mediaType });
      setStatus("idle");
      setResult(null);
      setSaved(false);
    };
    reader.readAsDataURL(file);
  }

  async function analyse() {
    if (!image) return;
    setStatus("loading");
    setError("");

    const prompt = `You are a nutrition expert. Analyse this food image and return ONLY a JSON object with no extra text, no markdown, no backticks. Use this exact structure:
{
  "meal_name": "short descriptive name",
  "description": "one sentence describing what you see and any key ingredients",
  "calories": 450,
  "protein_g": 32,
  "carbs_g": 45,
  "fat_g": 14,
  "fibre_g": 6,
  "sugar_g": 8,
  "sodium_mg": 620,
  "saturated_fat_g": 4,
  "confidence_pct": 75
}
All numeric values must be integers. confidence_pct should be 40–95. Return ONLY the JSON object.`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.REACT_APP_ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: image.type, data: image.base64 } },
              { type: "text", text: prompt }
            ]
          }]
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `HTTP ${res.status}`);

      const raw = data.content.filter(b => b.type === "text").map(b => b.text).join("");
      const cleaned = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      setResult(parsed);
      setStatus("done");
    } catch (e) {
      setError(e.message);
      setStatus("error");
    }
  }

  function saveToLog() {
    if (!result) return;
    setLog(prev => [...prev, {
      name: result.meal_name,
      calories: result.calories,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    }]);
    setSaved(true);
  }

  const totalCal = log.reduce((s, e) => s + e.calories, 0);
  const conf = result ? Math.min(95, Math.max(0, result.confidence_pct)) : 0;

  return (
    <div className="app">
      <div className="inner">
        <header>
          <div className="logo">snap<span>.</span>nutrition</div>
          <div className="tagline">photo → macros</div>
        </header>

        {!image ? (
          <div className="upload-zone" onClick={() => fileRef.current.click()}>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
              onChange={e => handleFile(e.target.files[0])} />
            <div className="upload-icon">📷</div>
            <div className="upload-label">Photograph your meal</div>
            <div className="upload-sub">tap to upload</div>
          </div>
        ) : (
          <div className="preview-wrap">
            <img src={image.src} alt="meal preview" />
            <button className="preview-change" onClick={() => changeRef.current.click()}>change photo</button>
            <input ref={changeRef} type="file" accept="image/*" style={{ display: "none" }}
              onChange={e => handleFile(e.target.files[0])} />
          </div>
        )}

        {image && status !== "loading" && (
          <button className="btn-primary" onClick={analyse}>
            {status === "done" ? "analyse again →" : "analyse meal →"}
          </button>
        )}

        {status === "loading" && (
          <div className="loading">
            <div className="dots">
              <div className="dot" /><div className="dot" /><div className="dot" />
            </div>
            <div className="loading-text">reading your meal...</div>
          </div>
        )}

        {status === "error" && (
          <div className="error-box"><strong>Error:</strong> {error}</div>
        )}

        {status === "done" && result && (
          <div className="results">
            <div className="meal-name">{result.meal_name}</div>
            <div className="meal-desc">{result.description}</div>

            <div className="macro-grid">
              <div className="macro-card cals">
                <div>
                  <div className="macro-label">Calories</div>
                  <div className="macro-value">{result.calories}</div>
                </div>
                <div className="macro-unit">kcal</div>
              </div>
              {[["Protein", result.protein_g, "g"], ["Carbs", result.carbs_g, "g"],
                ["Fat", result.fat_g, "g"], ["Fibre", result.fibre_g, "g"]].map(([label, val, unit]) => (
                <div key={label} className="macro-card">
                  <div className="macro-label">{label}</div>
                  <div className="macro-value">{val}</div>
                  <div className="macro-unit">{unit}</div>
                </div>
              ))}
            </div>

            <div className="micro-section">
              <div className="micro-title">Micronutrients (est.)</div>
              {[["Sugar", result.sugar_g + "g"], ["Sodium", result.sodium_mg + "mg"],
                ["Saturated fat", result.saturated_fat_g + "g"]].map(([label, val]) => (
                <div key={label} className="micro-row">
                  <span>{label}</span><span className="micro-val">{val}</span>
                </div>
              ))}
            </div>

            <div className="conf-wrap">
              <div className="conf-header">
                <div className="conf-label">Estimate confidence</div>
                <div className="conf-pct">{conf}%</div>
              </div>
              <div className="conf-track">
                <div className="conf-fill" style={{ width: conf + "%" }} />
              </div>
            </div>

            <div className="disclaimer">
              Estimates are based on visual analysis. Actual values may vary depending on portion size, preparation, and ingredients.
            </div>

            <button
              className="btn-save"
              onClick={saveToLog}
              disabled={saved}
              style={{ background: saved ? "var(--sage)" : "var(--rust)", color: "#fff" }}
            >
              {saved ? "saved to log ✓" : "save to today's log →"}
            </button>
          </div>
        )}

        {log.length > 0 && (
          <div>
            <div className="divider" />
            <div className="log-title">Today's log</div>
            {log.map((entry, i) => (
              <div key={i} className="log-item">
                <div>
                  <div className="log-item-name">{entry.name}</div>
                  <div className="log-item-time">{entry.time}</div>
                </div>
                <div className="log-item-cal">{entry.calories} kcal</div>
              </div>
            ))}
            <div className="log-total">
              <div className="log-total-label">Total calories</div>
              <div className="log-total-val">{totalCal.toLocaleString()} kcal</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
