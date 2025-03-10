const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema({
  names: {
    type: String,
    unique: true,
    required: true,
  },
  email: { type: String, required: true, unique: true },
  contact: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  profilePicture: { type: String },
  joindDate: { type: Date, default: Date.now },

  verified: {
    type: Boolean,
    default: false,
  },
  verificationToken: String,
});

const Admin = mongoose.model("Admin", adminSchema);

module.exports = Admin;
