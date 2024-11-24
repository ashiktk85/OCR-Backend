const express = require("express");
const multer = require("multer");
const Tesseract = require("tesseract.js");
const cors = require("cors");
const extractAadharDetails = require("./utils/DetailsExtraction");

const app = express();

app.use(cors());
app.use(express.json());

const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPEG and PNG are allowed."));
    }
  },
});

app.post("/upload-aadhar",upload.fields([{ name: "frontSide", maxCount: 1 },{ name: "backSide", maxCount: 1 },]),async (req, res) => {
    try {
      const frontSide = req.files["frontSide"][0];
      const backSide = req.files["backSide"][0];

      const frontOCR = await performOCR(frontSide.buffer);
      const backOCR = await performOCR(backSide.buffer);
      console.log(frontOCR , backOCR);
      
      const data = extractAadharDetails(frontOCR, backOCR);
      console.log(data);
      res.status(200).json(data);
    } catch (error) {
      console.error("Upload and OCR error:", error);
      res
        .status(500)
        .json({ error: "Processing failed", details: error.message });
    }
  }
);

async function performOCR(imageBuffer) {
  try {
    const {
      data: { text },
    } = await Tesseract.recognize(imageBuffer, "eng", {
      logger: (m) => console.log(m),
      tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
      preprocess: true,
    });

    const cleanedText = cleanOCRText(text);

    return cleanedText;
  } catch (error) {
    console.error("OCR Processing Error:", error);
    throw error;
  }
}

function cleanOCRText(text) {
  let cleanedText = text.replace(/\s+/g, " ").trim();

  const extractedInfo = {
    aadharNumber: extractAadharNumber(cleanedText),
    name: extractName(cleanedText),
    rawText: cleanedText,
  };

  return extractedInfo;
}

function extractAadharNumber(text) {
  const aadharRegex = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
  const match = text.match(aadharRegex);
  return match ? match[0].replace(/\s/g, "") : null;
}

function extractName(text) {
  const nameRegex = /[A-Z][a-z]+ [A-Z][a-z]+/;
  const match = text.match(nameRegex);
  return match ? match[0] : null;
}

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: "Something went wrong!",
    message: err.message,
  });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
