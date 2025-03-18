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

    // Validation regex patterns
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/; // Valid email format
    const contactPattern = /^[0-9]{10}$/; // Exactly 10-digit phone number
    const minPasswordLength = 6;

    // Validate Identifier (must be a valid email or 10-digit contact)
    if (
      !identifier ||
      (!emailPattern.test(identifier) && !contactPattern.test(identifier))
    ) {
      return res.status(400).json({
        message: "Invalid identifier. Use a valid email or 10-digit contact.",
      });
    }

    // Validate Password (minimum 6 characters)
    if (!password || password.length < minPasswordLength) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters long." });
    }

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
      },
    });
  } catch (error) {
    console.error("Error during login", error);
    res.status(500).json({ message: "Login failed" });
  }
});

app.post("/register-user", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    //create a new user
    const newUser = new User({ name, email, password });

    //generate and store the verification token
    newUser.verificationToken = crypto.randomBytes(20).toString("hex");

    //save the  user to the database
    await newUser.save();

    //send the verification email to the user
    sendVerificationEmail(newUser.email, newUser.verificationToken);

    res.status(200).json({ message: "Registration successful" });
  } catch (error) {
    console.log("error registering user", error);
    res.status(500).json({ message: "error registering user" });
  }
});

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
      return res.status(404).json({ message: "Invalid token" });
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

app.post("/login", async (req, res) => {
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
    const user = await Admin.findOne({ email });
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
      from: "uga-school.com",
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

//endpoint to unfollow a user
app.post("/users/unfollow", async (req, res) => {
  const { loggedInUserId, targetUserId } = req.body;

  try {
    await User.findByIdAndUpdate(targetUserId, {
      $pull: { followers: loggedInUserId },
    });

    res.status(200).json({ message: "Unfollowed successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error unfollowing user" });
  }
});

//endpoint to create a new post in the backend
app.post("/create-post", async (req, res) => {
  try {
    const { content, userId } = req.body;

    const newPostData = {
      user: userId,
    };

    if (content) {
      newPostData.content = content;
    }

    const newPost = new Post(newPostData);

    await newPost.save();

    res.status(200).json({ message: "Post saved successfully" });
  } catch (error) {
    res.status(500).json({ message: "post creation failed" });
  }
});

//endpoint for liking a particular post
app.put("/posts/:postId/:userId/like", async (req, res) => {
  const postId = req.params.postId;
  const userId = req.params.userId; // Assuming you have a way to get the logged-in user's ID

  try {
    const post = await Post.findById(postId).populate("user", "name");

    const updatedPost = await Post.findByIdAndUpdate(
      postId,
      { $addToSet: { likes: userId } }, // Add user's ID to the likes array
      { new: true } // To return the updated post
    );

    if (!updatedPost) {
      return res.status(404).json({ message: "Post not found" });
    }
    updatedPost.user = post.user;

    res.json(updatedPost);
  } catch (error) {
    console.error("Error liking post:", error);
    res
      .status(500)
      .json({ message: "An error occurred while liking the post" });
  }
});

//endpoint to unlike a post
app.put("/posts/:postId/:userId/unlike", async (req, res) => {
  const postId = req.params.postId;
  const userId = req.params.userId;

  try {
    const post = await Post.findById(postId).populate("user", "name");

    const updatedPost = await Post.findByIdAndUpdate(
      postId,
      { $pull: { likes: userId } },
      { new: true }
    );

    updatedPost.user = post.user;

    if (!updatedPost) {
      return res.status(404).json({ message: "Post not found" });
    }

    res.json(updatedPost);
  } catch (error) {
    console.error("Error unliking post:", error);
    res
      .status(500)
      .json({ message: "An error occurred while unliking the post" });
  }
});

//endpoint to get all the posts
app.get("/get-posts", async (req, res) => {
  try {
    const posts = await Post.find()
      .populate("user", "name")
      .sort({ createdAt: -1 });

    res.status(200).json(posts);
  } catch (error) {
    res
      .status(500)
      .json({ message: "An error occurred while getting the posts" });
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
