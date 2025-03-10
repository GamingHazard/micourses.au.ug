const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    unique: true,
    required: true,
  },
  email: { type: String, required: true, unique: true },
  contact: { type: String, required: true, unique: true },
  gender: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  profilePicture: { type: String },
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
