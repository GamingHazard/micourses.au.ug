const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const cloudinary = require("./Cloudinary");
const app = express();
const port = 3000;
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const path = require("path");

app.use(
  cors({
    origin: "*",
    methods: "GET,POST,PATCH,DELETE,PUT,OPTIONS",
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

mongoose
  .connect(process.env.DB_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((err) => {
    console.log("Error Connecting to MongoDB");
  });

app.listen(port, () => {
  console.log("server is running on port 3000");
});

const User = require("./models/users");
const Admin = require("./models/admin");
const Courses = require("./models/courses");

// CONFIGURATIONS
const sendVerificationEmail = async (email, verificationToken) => {
  //create a nodemailer transporter

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  //compose the email message
  const mailOptions = {
    from: "mimobilecourses.com",
    to: email,
    subject: "Email Verification",
    text: `please click the following link to verify your email https://micourses-au-ug.onrender.com/verify/${verificationToken}`,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.log("error sending email", error);
  }
};

app.get("/verify/:token", async (req, res) => {
  try {
    const token = req.params.token;

    const user = await Admin.findOne({ verificationToken: token });
    if (!user) {
      return res.status(404).sendFile("error.html", { root: "public" });
    }

    user.verified = true;
    user.verificationToken = undefined;
    await user.save();

    res.status(200).sendFile("success.html", { root: "public" });
  } catch (error) {
    console.log("error getting token", error);
    res.status(500).sendFile("error.html", { root: "public" });
  }
});

const generateSecretKey = () => {
  const secretKey = crypto.randomBytes(32).toString("hex");
  return secretKey;
};

const secretKey = generateSecretKey();

app.get("/cloudinary-signature/:preset", async (req, res) => {
  const { preset } = req.params; // Correctly access preset from the URL params

  if (!preset) {
    return res.status(400).json({ error: "preset is required" });
  }

  const timestamp = Math.round(new Date().getTime() / 1000);
  const signature = cloudinary.utils.api_sign_request(
    { timestamp, upload_preset: preset }, // Pass the preset here
    cloudinary.config().api_secret
  );

  res.json({ timestamp, signature });
});

// AUTHENTICATION

app.post("/register-admin", async (req, res) => {
  try {
    const { names, contact, email, password } = req.body;

    // Validation regex patterns
    const namesPattern = /^[a-zA-Z]+(?:\s{0,2}[a-zA-Z]+)*$/; // Only letters with max 2 spaces
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/; // Valid email format
    const contactPattern = /^[0-9]{10}$/; // Exactly 10 digits
    const minPasswordLength = 6;

    // Validate Names
    if (!names || !namesPattern.test(names.trim())) {
      return res.status(400).json({
        message: "Invalid names. Only text allowed with max of 2 spaces.",
      });
    }

    // Validate Email
    if (!email || !emailPattern.test(email.trim())) {
      return res.status(400).json({ message: "Invalid email format." });
    }

    // Validate Contact
    if (!contact || !contactPattern.test(contact.trim())) {
      return res.status(400).json({
        message: "Invalid contact number. Must be exactly 10 digits.",
      });
    }

    // Validate Password
    if (!password || password.length < minPasswordLength) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters long." });
    }

    // Check if email is already registered
    const existingUser = await Admin.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    // Hash the password before saving the user
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new admin user
    const newUser = new Admin({
      names: names.trim(),
      contact: contact.trim(),
      email: email.trim(),
      password: hashedPassword,
    });

    // Generate and store the verification token
    newUser.verificationToken = crypto.randomBytes(20).toString("hex");

    // Send the verification email to the user
    sendVerificationEmail(newUser.email, newUser.verificationToken);

    // Save the user to the database
    await newUser.save();

    // Generate JWT Token
    const token = jwt.sign({ userId: newUser._id }, secretKey, {
      expiresIn: "1h",
    });

    // Return user details (excluding password for security)
    const profile = {
      names: newUser.names,
      email: newUser.email,
      contact: newUser.contact,
      verified: newUser.verified,
    };

    res.status(200).json({
      message: "Registration successful",
      data: profile,
      token,
      id: newUser._id,
    });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({ message: "Error registering user" });
  }
});

//  Endpoint for admin Login
app.post("/admin-login", async (req, res) => {
  try {
    const { identifier, password } = req.body;
    // Find user by email or phone
    const user = await Admin.findOne({
      $or: [{ email: identifier }, { contact: identifier }],
    });

    if (!user) {
      return res.status(404).json({ message: "Wrong Email or Contact" });
    }

    // Check if the password matches
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Wrong password" });
    }

    // Generate JWT token
    const token = jwt.sign({ userId: user._id }, secretKey, {
      expiresIn: "1h",
    });

    // Respond with the token and user information
    res.status(200).json({
      token,
      id: user._id,
      user: {
        names: user.names,
        email: user.email,
        profilePicture: user.profilePicture,
        contact: user.contact,
        recoveryEmail: user.recoverEmail,
      },
    });
  } catch (error) {
    console.error("Error during login", error);
    res.status(500).json({ message: "Login failed" });
  }
});

app.post("/user-email", async (req, res) => {
  const { email } = req.body;

  try {
    // Check if the user exists
    const user = await User.findOne({ email });
    if (user) return res.status(401).json({ message: "Email already exists" });

    function get6DigitRandom() {
      // Generates a random number between 100000 and 999999
      return Math.floor(100000 + Math.random() * 900000);
    }

    // Generate 5-digit alphanumeric code
    const verificationCode = get6DigitRandom();

    // Create a new admin user
    const newUser = new User({
      email: email.trim(),
      verificationToken: verificationCode,
    });
    // Send the verification email to the user
    await newUser.save();

    // Configure the nodemailer transporter
    const transporter = nodemailer.createTransport({
      service: "gmail", // Change to your email service provider
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Email options
    const mailOptions = {
      from: "micourses.com",
      to: email,
      subject: "Email Verification code",
      text: `Your email verification code is: ${verificationCode}`,
    };

    // Send the email
    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: "verification code sent to email" });
  } catch (error) {
    console.error("Error in /get-code:", error);
    res.status(500).json({ message: "An error occurred", error });
  }
});
// Endpoint to verify recovery email
app.patch("/verify-user-email", async (req, res) => {
  const { code } = req.body;
  try {
    const user = await User.find({ code });

    // If no user is found, return an error
    if (!user) {
      return res.status(404).json({ message: "user not found" });
    }

    user.verified = true;
    user.verificationToken = "";

    await user.save();
    res.status(200).json({
      message: "email verified",
      verified: user.verified,
      userId: user._id,
    });
  } catch (error) {
    console.error("Error verifying reset code:", error);
    res.status(500).json({ message: "Server error" });
  }
});
// UPDATING ENDPOINTS
app.patch("/register-user", async (req, res) => {
  const { firstName, secondName, gender, birth, contact, password, id } =
    req.body;

  if (!mongoose.Types.ObjectId.isValid({ id })) {
    return res.status(400).json({ error: "Invalid user ID" });
  }

  try {
    const updateFields = {
      firstName,
      secondName,
      gender,
      dateOfBirth: birth,
      contact,
    };

    const updatedUser = await User.findByIdAndUpdate(id, updateFields, {
      new: true,
      runValidators: true,
    });

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    res
      .status(200)
      .json({ message: "User updated successfully", user: updatedUser });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({ error: error.message });
  }
});
app.post("/user-login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "Invalid email" });
    }

    if (user.password !== password) {
      return res.status(404).json({ message: "Invalid password" });
    }

    const token = jwt.sign({ userId: user._id }, secretKey);

    res.status(200).json({ token });
  } catch (error) {
    res.status(500).json({ message: "Login failed" });
  }
});

// FORGOT PASSWORD ENDPOINTS
// send random code to user
app.post("/get-code", async (req, res) => {
  const { email } = req.body;

  try {
    // Check if the user exists
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    function get6DigitRandom() {
      // Generates a random number between 100000 and 999999
      return Math.floor(100000 + Math.random() * 900000);
    }

    // Generate 5-digit alphanumeric code
    const resetCode = get6DigitRandom();
    // Save the reset code to the user's document in the database
    user.resetCode = resetCode;
    await user.save();

    // Configure the nodemailer transporter
    const transporter = nodemailer.createTransport({
      service: "gmail", // Change to your email service provider
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Email options
    const mailOptions = {
      from: "micourses.com",
      to: email,
      subject: "Password Reset Code",
      text: `Your password reset code is: ${resetCode}`,
    };

    // Send the email
    await transporter.sendMail(mailOptions);
    res.json({ message: "Reset code sent to email" });
  } catch (error) {
    console.error("Error in /get-code:", error);
    res.status(500).json({ message: "An error occurred", error });
  }
});

// verify the random  code
app.post("/verify-code", async (req, res) => {
  const { email, code } = req.body;

  try {
    // Query the database to find a user with the provided email and reset code
    const user = await Admin.findOne({ email, resetCode: code });

    // If no user is found, return an error
    if (!user) {
      return res.status(400).json({ message: "Invalid code or email" });
    }

    // Generate a temporary JWT token for password reset
    const resetToken = jwt.sign({ email }, process.env.JWT_SECRET, {
      expiresIn: "15m",
    });
    // Clear the reset code after successful verification to prevent reuse
    user.resetCode = "";
    await user.save();

    res.status(200).json({
      message: "Code verified",
      resetToken,
      user: {
        id: user._id,
      },
    });
  } catch (error) {
    console.error("Error verifying reset code:", error);
    res.status(500).json({ message: "Server error" });
  }
});

//  Endpoint for resetting password
app.post("/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find the user by the decoded email
    const user = await Admin.findOne({ email: decoded.email });

    if (!user) return res.status(404).json({ message: "User not found" });

    // Hash the new password and save it
    user.password = await bcrypt.hash(newPassword, 10);
    user.resetCode = ""; // Clear the reset code

    // Save the updated user
    await user.save();

    res.json({ message: "Password reset successful" });
  } catch (error) {
    console.error("Error resetting password:", error);
    res.status(400).json({ message: "Invalid or expired token" });
  }
});
// Endpoint to set a recovery email
app.post("/recovery-email", async (req, res) => {
  const { email, id } = req.body;

  try {
    // Check if the user exists
    const user = await Admin.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Generate 5-digit alphanumeric code
    const resetCode = crypto.randomBytes(3).toString("hex");

    // Save the reset code to the user's document in the database
    user.resetCode = resetCode;
    await user.save();

    // Configure the nodemailer transporter
    const transporter = nodemailer.createTransport({
      service: "gmail", // Change to your email service provider
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Email options
    const mailOptions = {
      from: "micourses.com",
      to: email,
      subject: "Password Reset Code",
      text: `Your verification code is: ${resetCode}`,
    };

    // Send the email
    await transporter.sendMail(mailOptions);
    res.json({ message: "Reset code sent to email" });
  } catch (error) {
    console.error("Error in /get-code:", error);
    res.status(500).json({ message: "An error occurred", error });
  }
});
// Endpoint to verify recovery email
app.patch("/verify-recover-email", async (req, res) => {
  const { email, code, id } = req.body;

  try {
    const user = await Admin.findById(id);

    // If no user is found, return an error
    if (!user) {
      return res.status(400).json({ message: "user not found" });
    }
    if (code === user.resetCode) {
      // Clear the reset code after successful verification to prevent reuse
      user.resetCode = "";
      user.recoverEmail = email;

      await user.save();
      res.status(200).json({
        message: "Code verified",
      });
    }
  } catch (error) {
    console.error("Error verifying reset code:", error);
    res.status(500).json({ message: "Server error" });
  }
});
// DELETE ACCOUNTS
app.delete("/delete-account", async (req, res) => {
  const { id, password } = req.body;

  // 1) Verify admin exists
  const adminUser = await Admin.findById({ id });
  if (!adminUser) {
    return res.status(404).json({ message: "Admin not found" });
  }

  // 2) Validate password
  const isPasswordValid = await bcrypt.compare(password, adminUser.password);
  if (!isPasswordValid) {
    return res.status(401).json({
      message: "Invalid password. Please check and try again.",
    });
  }

  try {
    // 3) Fetch all courses belonging to this admin
    const courses = await Courses.find({ adminId: id });
    if (courses.length === 0) {
      // nothing to delete
      return res
        .status(200)
        .json({ message: "Account deleted. No courses to remove." });
    }

    // 4) Collect all coverImage public_Ids
    const coverIds = courses.map((c) => c.coverImage.public_Id);

    // 5) Collect all video public_Ids
    const videoIds = courses.flatMap((c) => c.videos.map((v) => v.public_Id));

    // 6) Delete all cover images
    await Promise.all(
      coverIds.map((public_Id) => cloudinary.uploader.destroy(public_Id))
    );

    // 7) Delete all videos
    await Promise.all(
      videoIds.map((public_Id) =>
        cloudinary.uploader.destroy(public_Id, { resource_type: "video" })
      )
    );

    // 8) Delete the course documents
    await Courses.deleteMany({ adminId: id });

    // 9) Optionally delete the admin user itself
    await Admin.findByIdAndDelete(id);

    res
      .status(200)
      .json({ message: "Account and all related courses deleted." });
  } catch (error) {
    console.error("Error deleting account:", error);
    res.status(500).json({
      message:
        "An unexpected error occurred while deleting the account. Please try again later.",
      error: error.message,
    });
  }
});

// UPDATING ENDPOINTS
app.patch("/update-admin", async (req, res) => {
  const { names, email, contact, recoveryEmail, id } = req.body;

  if (!mongoose.Types.ObjectId.isValid({ id })) {
    return res.status(400).json({ error: "Invalid user ID" });
  }

  try {
    const updateFields = { names, email, contact, recoveryEmail };

    const updatedUser = await Admin.findByIdAndUpdate(id, updateFields, {
      new: true,
      runValidators: true,
    });

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    res
      .status(200)
      .json({ message: "User updated successfully", admin: updatedUser });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({ error: error.message });
  }
});
//endpoint to follow a particular user
app.post("/follow", async (req, res) => {
  const { currentUserId, selectedUserId } = req.body;

  try {
    await User.findByIdAndUpdate(selectedUserId, {
      $push: { followers: currentUserId },
    });

    res.sendStatus(200);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "error in following a user" });
  }
});

// CHANGE admin PASSWORD
// Endpoint for User password
app.post("/admin-password/:UserId", async (req, res) => {
  try {
    const { password } = req.body;
    const adminid = req.params.UserId;

    // Find user by ID
    const user = await Admin.findById(adminid); // Assuming _id is used as the primary key

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (!password) {
      return res.status(400).json({ message: "Password is required" });
    }

    // Validate the password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        message: "Invalid password. Please check and try again.",
      });
    }

    // Respond with token and user info
    res.status(200).json({
      user: {
        id: user._id,
        fname: user.fname,
        sname: user.sname,
        email: user.email,
        phone: user.phone,
      },
    });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ message: "failed to get password" });
  }
});

// endpoint for updating user password
app.patch("/change-password/:id", async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const { id } = req.params;

    // Find user by ID
    const user = await Admin.findById(id); // Assuming _id is used as the primary key

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Validate the current password
    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password
    );
    if (!isPasswordValid) {
      return res.status(401).json({
        message: "Invalid current password. Please check and try again.",
      });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the user's password in the database
    user.password = hashedPassword;
    await user.save();

    res.status(200).json({
      message: "Password changed successfully.",
    });
  } catch (error) {
    console.error("Error updating password:", error);
    res
      .status(500)
      .json({ message: "Password update failed due to a server error." });
  }
});
// Endpoint for  creating courses
app.post("/create-course", async (req, res) => {
  try {
    const {
      courseName,
      sector,
      videos,
      duration,
      coverImage,
      adminId,
      description,
    } = req.body;

    // Basic validation
    if (
      !courseName ||
      !sector ||
      !duration ||
      !adminId ||
      !Array.isArray(videos) ||
      videos.length === 0
    ) {
      return res
        .status(400)
        .json({ message: "Some data is missing or invalid" });
    }

    // Check for duplicate course
    const existingCourse = await Courses.findOne({ courseName });
    if (existingCourse) {
      return res
        .status(409)
        .json({ message: "A course with this title already exists" });
    }

    // Create and save the course
    const newCourse = new Courses({
      courseName,
      sector,
      videos,
      coverImage,
      adminId,
      description,
      duration,
    });

    await newCourse.save();

    res.status(201).json({
      message: "Course created successfully",
    });
  } catch (error) {
    console.error("Error creating course:", error);
    res.status(500).json({
      message: "Failed to create course",
      error: error.message,
    });
  }
});

// Endpoint to get all courses
app.get("/course/:category", async (req, res) => {
  try {
    const { category } = req.params; // Corrected from 'categories' to 'category'

    // Fetch courses for the given category
    const courses = await Courses.find({ sector: category }).sort({
      createdAt: -1,
    });

    if (courses.length === 0) {
      return res
        .status(404)
        .json({ message: "No course found for this sector" });
    }

    res.status(200).json({
      message: "Courses fetched successfully",
      courses,
    });
  } catch (error) {
    console.error("Error fetching courses:", error);
    res.status(500).json({ message: "Failed to fetch courses" });
  }
});
// Endpoint to get all courses
app.get("/courses", async (req, res) => {
  try {
    // Fetch courses for the given category
    const courses = await Courses.find().sort({
      createdAt: -1,
    });

    if (courses.length === 0) {
      return res.status(404).json({ message: "No course found " });
    }

    res.status(200).json({
      message: "Courses fetched successfully",
      courses,
    });
  } catch (error) {
    console.error("Error fetching courses:", error);
    res.status(500).json({ message: "Failed to fetch courses" });
  }
});

// Endpoint for deleting a course
app.delete("/delete-course/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // 1) Find the course first (so we know its images/videos)
    const course = await Courses.findById(id);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // 2) Delete cover image using the correct property name
    const coverImageResult = await cloudinary.uploader.destroy(
      course.coverImage.public_Id
    );
    console.log("Cover image delete response:", coverImageResult);

    // 3) Delete each video with logging
    for (const vid of course.videos) {
      const videoResult = await cloudinary.uploader.destroy(vid.public_Id, {
        resource_type: "video",
      });
      console.log(`Video delete response for ${vid.public_Id}:`, videoResult);
    }

    // 4) Finally, remove the course document from the database
    await Courses.findByIdAndDelete(id);

    res.status(200).json({
      message: `Course with ID "${id}" deleted successfully`,
      deletedCourse: course,
    });
  } catch (error) {
    console.error("Error deleting course:", error);
    res
      .status(500)
      .json({ message: "Failed to delete course", error: error.message });
  }
});

// Endpoint to update courses
app.patch("/update-course/:id", async (req, res) => {
  try {
    const { id } = req.params;
    // 1) Find the course first (so we know its images )
    const course = await Courses.findById(id);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // 2) Delete cover image
    await cloudinary.uploader.destroy(course.coverImage.public_Id);
    // 3) create  an empty updates object
    const updates = {};

    // 4) Only copy over the fields the client sent
    [
      "courseName",
      "sector",
      "duration",
      "description",
      "coverImage",
      "videos",
      "adminId",
    ].forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    // 5) Make sure there's something to update
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No valid fields to update" });
    }

    // 6) Perform the update
    const updatedCourse = await Courses.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!updatedCourse) {
      return res.status(404).json({ message: "Course not found" });
    }

    res.status(200).json({
      message: "Course updated successfully",
      course: updatedCourse,
    });
  } catch (error) {
    console.error("Error updating course:", error);
    res.status(500).json({
      message: "Failed to update course",
      error: error.message,
    });
  }
});

// endpoint for saving a particular course
app.put("/course/save", async (req, res) => {
  const { courseId, userId } = req.body;

  try {
    const courses = await Courses.findById({ courseId });
    const user = await User.findById({ userId });

    if (!courses || !user) {
      return res.status(404).json({ message: "user or course not found" });
    }
    const updatedCourse = await Courses.findByIdAndUpdate(
      courseId,
      { $addToSet: { likes: userId } }, // Add user's ID to the likes array
      { new: true } // To return the updated post
    );

    // updating the user's saved courses
    await User.findByIdAndUpdate(
      userId,
      { $addToSet: { savedCourses: courseId } }, // Add user's ID to the likes array
      { new: true } // To return the updated post
    );
    res.json(updatedCourse);
  } catch (error) {
    console.error("Error liking post:", error);
    res
      .status(500)
      .json({ message: "An error occurred while liking the post" });
  }
});

//endpoint to unsave a post
app.put("/course/unsave", async (req, res) => {
  const { courseId, userId } = req.body;

  try {
    const courses = await Courses.findById({ courseId });
    const user = await User.findById({ userId });

    if (!user || !courses) {
      return res.status(404).json({ message: "user or course not found" });
    }
    const updatedCourse = await Courses.findByIdAndUpdate(
      courseId,
      { $pull: { likes: userId } },
      { new: true }
    );
    await User.findByIdAndUpdate(
      userId,
      { $pull: { savedCoursess: courseId } },
      { new: true }
    );

    res.json(updatedCourse);
  } catch (error) {
    console.error("Error unsaving post:", error);
    res
      .status(500)
      .json({ message: "An error occurred while unsaving the course" });
  }
});

// endpoint to enroll for a course
app.put("/course/enroll", async (req, res) => {
  const { courseId, userId } = req.body;
  try {
    const user = await User.findByIdAndUpdate(
      userId,
      { $addToSet: { enrolledCourses: courseId } }, // Add course's ID to the enrolledCourses array
      { new: true } // To return the updated post
    );
    if (!user) {
      return res.status(404).json({ message: "user not found" });
    }

    await user.save(); //save the updates

    let enrolledCourse = user.enrolledCourses.course === courseId;
    res.status(200).json({
      message: `yous have successfully enrolled for${""} ${
        enrolledCourse.courseName
      }`,
    });
  } catch (error) {
    console.error("Error liking post:", error);
    res
      .status(500)
      .json({ message: "An error occurred while liking the post" });
  }
});

app.get("/profile/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({ user });
  } catch (error) {
    res.status(500).json({ message: "Error while getting the profile" });
  }
});
