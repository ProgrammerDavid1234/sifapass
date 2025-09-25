import express from "express";
import cloudinary from "cloudinary";

const router = express.Router();

// 👇 Test Cloudinary upload
router.get("/test-cloudinary", async (req, res) => {
  try {
    const uploadResult = await cloudinary.v2.uploader.upload(
      "https://res.cloudinary.com/demo/image/upload/sample.jpg",
      {
        folder: "test",
      }
    );
    console.log("Upload result:", uploadResult.secure_url);
    res.json({
      success: true,
      url: uploadResult.secure_url,
    });
  } catch (error) {
    console.error("Cloudinary test error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;
