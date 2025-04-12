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
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    userReviews: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        content: {
          type: String,
          required: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
        likes: [
          {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
          },
           
        ],
        unlikes: [
          {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
          },
        ],
      },
    ],
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
