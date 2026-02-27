require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

const app = express();

// ====== MIDDLEWARE ======
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.set("view engine", "ejs");

// ====== CONNECT MONGODB ======
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log(err));

// ====== MODELS ======
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  email: { type: String, unique: true },
  phone: String,
  password: String
});

const eventSchema = new mongoose.Schema({
  name: String,
  category: String
});

const registrationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  event: { type: mongoose.Schema.Types.ObjectId, ref: "Event" },
  registeredAt: { type: Date, default: Date.now }
});

const User = mongoose.model("User", userSchema);
const Event = mongoose.model("Event", eventSchema);
const Registration = mongoose.model("Registration", registrationSchema);

// ====== AUTH MIDDLEWARE ======
function auth(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.redirect("/login");

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch {
    res.redirect("/login");
  }
}

// ====== CREATE EVENTS (RUN ONCE) ======
async function seedEvents() {
  const count = await Event.countDocuments();
  if (count === 0) {
    await Event.insertMany([
      { name: "Hackathon", category: "Tech" },
      { name: "Coding Contest", category: "Tech" },
      { name: "AI Workshop", category: "Tech" },

      { name: "Dance", category: "Cultural" },
      { name: "Music", category: "Cultural" },
      { name: "Drama", category: "Cultural" },

      { name: "Football", category: "Sports" },
      { name: "Cricket", category: "Sports" },
      { name: "Basketball", category: "Sports" },

      { name: "Photography", category: "Other" },
      { name: "Quiz", category: "Other" },
      { name: "Debate", category: "Other" }
    ]);
    console.log("Events Seeded");
  }
}
seedEvents();

// ====== ROUTES ======

// HOME
app.get("/", (req, res) => {
  res.redirect("/login");
});

// REGISTER PAGE
app.get("/register", (req, res) => {
  res.send(`
    <h2>Register</h2>
    <form method="POST">
      <input name="username" placeholder="Username" required/><br/>
      <input name="email" placeholder="Email" required/><br/>
      <input name="phone" placeholder="Phone" required/><br/>
      <input type="password" name="password" placeholder="Password" required/><br/>
      <button>Register</button>
    </form>
    <a href="/login">Login</a>
  `);
});

// REGISTER POST
app.post("/register", async (req, res) => {
  const { username, email, phone, password } = req.body;

  const hashed = await bcrypt.hash(password, 10);

  try {
    await User.create({ username, email, phone, password: hashed });
    res.redirect("/login");
  } catch {
    res.send("User already exists");
  }
});

// LOGIN PAGE
app.get("/login", (req, res) => {
  res.send(`
    <h2>Login</h2>
    <form method="POST">
      <input name="loginId" placeholder="Username or Email" required/><br/>
      <input type="password" name="password" placeholder="Password" required/><br/>
      <button>Login</button>
    </form>
    <a href="/register">Register</a>
  `);
});

// LOGIN POST
app.post("/login", async (req, res) => {
  const { loginId, password } = req.body;

  const user = await User.findOne({
    $or: [{ username: loginId }, { email: loginId }]
  });

  if (!user) return res.send("User not found");

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.send("Wrong password");

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
  res.cookie("token", token);
  res.redirect("/dashboard");
});

// DASHBOARD
app.get("/dashboard", auth, async (req, res) => {
  const events = await Event.find();

  let html = `<h1>Event Dashboard</h1><a href="/my-events">My Events</a><br/><br/>`;

  const categories = ["Tech", "Cultural", "Sports", "Other"];

  categories.forEach(category => {
    html += `<h2>${category}</h2>`;
    events.filter(e => e.category === category)
      .forEach(event => {
        html += `
          <p>${event.name}
          <form method="POST" action="/register-event/${event._id}">
            <button>Register</button>
          </form>
          </p>
        `;
      });
  });

  res.send(html);
});

// REGISTER EVENT
app.post("/register-event/:id", auth, async (req, res) => {
  await Registration.create({
    user: req.userId,
    event: req.params.id
  });

  res.redirect("/my-events");
});

// MY EVENTS PAGE
app.get("/my-events", auth, async (req, res) => {
  const registrations = await Registration.find({ user: req.userId })
    .populate("event");

  let html = `<h1>My Registered Events</h1>
              <a href="/dashboard">Back</a><br/><br/>`;

  registrations.forEach(r => {
    html += `
      <p>
        Event: ${r.event.name} <br/>
        Category: ${r.event.category} <br/>
        Registered At: ${r.registeredAt}
      </p><hr/>
    `;
  });

  res.send(html);
});

// LOGOUT
app.get("/logout", (req, res) => {
  res.clearCookie("token");
  res.redirect("/login");
});

// SERVER START
app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});