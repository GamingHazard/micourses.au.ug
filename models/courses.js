const mongoose = require("mongoose");

const CourseSchema = new mongoose.Schema(
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
    },
    description: {
      type: String,
      required: true,
    },
    coverImage: {
      url: { type: String, required: true, default: "" },
      public_Id: { type: String, required: true, default: "" },
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

const Courses = mongoose.model("Courses", CourseSchema);

module.exports = Courses;
