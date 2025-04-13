const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  profilePicture: { type: String, default: "" },

  firstName: {
    type: String,
    default: "",
  },
  secondName: {
    type: String,
    default: "",
  },
  email: { type: String, unique: true, default: "" },
  contact: { type: String, unique: true, default: "" },
  gender: { type: String, default: "" },
  dateOfBirth: { type: Date },

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
