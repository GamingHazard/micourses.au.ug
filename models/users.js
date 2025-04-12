const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  profilePicture: { type: String, default: "" },

  name: {
    type: String,
    unique: true,
    required: true,
  },
  email: { type: String, required: true, unique: true },
  contact: { type: String, required: true, unique: true },
  gender: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  enrolledCourses: [
    {
      course: { type: mongoose.Schema.Types.ObjectId, ref: "Courses" },
      enrolledAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  savedCourses: [
    {
      course: { type: mongoose.Schema.Types.ObjectId, ref: "Courses" },
      savedAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  finishedCourses: [
    {
      course: { type: mongoose.Schema.Types.ObjectId, ref: "Courses" },
      finishedAts: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  verified: {
    type: Boolean,
    default: false,
  },
  verificationToken: String,
  resetCode: {
    type: String,
    default: "",
  },
  joindDate: { type: Date, default: Date.now },
});

const User = mongoose.model("User", userSchema);

module.exports = User;
