const mongoose = require("mongoose");

const GallerySchema = new mongoose.Schema(
  {
    courseName: {
      type: String,
      required: true,
      index: true,
    },
    sector: {
      type: String,
      required: true,
      index: true,
    },
    duration: {
      type: String,
      required: true,
      index: true,
    },
    coverImage: {
      url: { type: String, default: "" },
      public_Id: { type: String, default: "" },
      required: true,
    },
    videos: {
      type: [
        {
          url: {
            type: String,
            required: true,
          },
          public_Id: {
            type: String,
            required: true,
          },
        },
      ],
      default: [],
    },
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

const Gallery = mongoose.model("Gallery", GallerySchema);

module.exports = Gallery;
