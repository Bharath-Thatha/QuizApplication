const express = require("express");
const dotenv = require("dotenv");
const nodemon = require("nodemon");
const mongoose = require("mongoose");
const session = require("express-session");
const path = require("path");
const { User, Admin, Profile, Assessment } = require("./model/user.js");
const e = require("express");

const port = 3200;
const app = express();

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: "your-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false },
  })
);

app.set("view engine", "ejs");

app.listen(port, () => {
  console.log(`server is running on port ${port}`);
});

dotenv.config();

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("DataBase connected Successfully");
  })
  .catch((err) => {
    console.log("Error : ", err);
  });

function checkCompanyAuth(req, res, next) {
  if (req.session && req.session.company) {
    next();
  } else {
    res.redirect("/");
  }
}

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "/index.html"));
});

app.get("/comp_dashboard", async (req, res) => {
  try {
    const admin = req.session.company;
    if (!admin) {
      return res.redirect("/login");
    }

    const assessments = await Assessment.find({});
    res.render("company_dashboard", { assessments, admin });
  } catch (error) {
    console.error("Error fetching assessments:", error);
    res.render("company_dashboard", { assessments: [], admin: null });
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

app.get("/add_users", (req, res) => {
  res.sendFile(path.join(__dirname, "./public/html/add_users.html"));
});

app.get("/comp_dashboard/create_quiz", (req, res) => {
  res.render("comp_quiz_creation");
});

app.get("/emp_dashboard/:emp_mail", async (req, res) => {
  const { emp_mail } = req.params;
  const user = await User.findOne({ emp_mail });

  if (!user) {
    return res.status(404).send("User not found");
  }

  const currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0); // normalize

  const availableAssessments = user.assessmentsDetails.filter((a) => {
    const start = new Date(a.start_date);
    const end = new Date(a.end_date);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return a.is_published && start <= currentDate && end >= currentDate;
  });

  const upcomingAssessments = user.assessmentsDetails.filter((a) => {
    const start = new Date(a.start_date);
    start.setHours(0, 0, 0, 0);
    return a.is_published && start > currentDate;
  });

  const expiredAssessments = user.assessmentsDetails.filter((a) => {
    const end = new Date(a.end_date);
    end.setHours(23, 59, 59, 999);
    return a.is_published && end < currentDate;
  });

  res.render("emp_dashboard", {
    user,
    availableAssessments,
    upcomingAssessments,
    expiredAssessments,
  });
});

app.get("/emp_profile/:emp_mail", async (req, res) => {
  try {
    const { emp_mail } = req.params;
    const user = await User.findOne({ emp_mail });
    const profile = await Profile.findOne({ email: emp_mail });

    if (!user || !profile) {
      return res.status(404).send("User not found");
    }
    const totalAssessments = user.assessmentsDetails.length;
    const completedAssessments = user.assessmentsDetails.filter(
      (a) => a.status === "Completed"
    ).length;
    const pendingAssessments = totalAssessments - completedAssessments;
    const passedAssessments = user.assessmentsDetails.filter(
      (a) => a.result && a.result.passed
    ).length;
    const recentResults = user.assessmentsDetails
      .filter((a) => a.result)
      .map((a) => a.result)
      .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at))
      .slice(0, 5);

    const stats = {
      totalAssessments,
      completedAssessments,
      pendingAssessments,
      passedAssessments,
      recentResults,
    };

    res.render("emp_profile", { user, profile, stats });
  } catch (error) {
    console.error("Error fetching employee profile:", error);
    res.status(500).send("Error fetching profile");
  }
});

app.get("/admin_profile/:admin_mail", async (req, res) => {
  try {
    const { admin_mail } = req.params;
    const admin = await Admin.findOne({ admin_mail });
    const profile = await Profile.findOne({ email: admin_mail });
    console.log(admin_mail, admin, profile);
    if (!admin || !profile) {
      return res.status(404).send("Admin not found");
    }
    const totalAssessments = await Assessment.countDocuments();
    const publishedAssessments = await Assessment.countDocuments({
      is_published: true,
    });
    const totalUsers = await User.countDocuments();
    const totalEmployees = await User.countDocuments({ type: "Employee" });
    const recentAssessments = await Assessment.find()
      .sort({ created_at: -1 })
      .limit(5)
      .select("assessment_name is_published created_at");

    const stats = {
      totalAssessments,
      publishedAssessments,
      totalUsers,
      totalEmployees,
      recentAssessments,
    };

    res.render("admin_profile", { admin, profile, stats });
  } catch (error) {
    console.error("Error fetching admin profile:", error);
    res.status(500).send("Error fetching profile");
  }
});

app.post("/emp_dashboard", async (req, res) => {
  const { emp_mail, emp_pass } = req.body;
  const user = await User.findOne({ emp_mail });

  if (user) {
    const matchpass = user.emp_pass;

    if (matchpass === emp_pass) {
      const currentDate = new Date();
      currentDate.setHours(0, 0, 0, 0); // Normalize time to 00:00:00
      req.session.emp = user;
      const availableAssessments = user.assessmentsDetails.filter((a) => {
        const start = new Date(a.start_date);
        const end = new Date(a.end_date);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        return a.is_published && start <= currentDate && end >= currentDate;
      });

      const upcomingAssessments = user.assessmentsDetails.filter((a) => {
        const start = new Date(a.start_date);
        start.setHours(0, 0, 0, 0);
        return a.is_published && start > currentDate;
      });

      const expiredAssessments = user.assessmentsDetails.filter((a) => {
        const end = new Date(a.end_date);
        end.setHours(23, 59, 59, 999);
        return a.is_published && end < currentDate;
      });

      res.render("emp_dashboard", {
        user,
        availableAssessments,
        upcomingAssessments,
        expiredAssessments,
      });
    } else {
      res.send("Wrong Credentials...");
    }
  } else {
    res.send("User not found.");
  }
});

app.post("/comp_dashboard", async (req, res) => {
  const { admin_mail, admin_pass } = req.body;
  const admin = await Admin.findOne({ admin_mail });
  if (admin) {
    const matchpass = admin.admin_pass;
    if (matchpass === admin_pass) {
      req.session.company = admin;
      const assessments = await Assessment.find({});
      res.render("company_dashboard", { assessments, admin });
    } else {
      res.send("Wrong Credentials...");
    }
  }
});

app.post("/add_users", async (req, res) => {
  const {
    name,
    emp_id,
    email,
    pass,
    confirmpass,
    gender,
    phone,
    date,
    user_type,
  } = req.body;
  // console.log(name,email,emp_id,gender,phone,date,user_type);
  if (pass === confirmpass) {
    let new_user;
    const new_profile = new Profile({
      name,
      emp_id,
      email,
      pass,
      gender,
      phone,
      date,
      user_type,
    });
    if (user_type === "emp") {
      const emp_pass = pass,
        emp_mail = email;
      console.log("user");
      new_user = new User({ name, emp_mail, emp_pass });
    } else {
      console.log("admin");
      const admin_pass = pass,
        admin_mail = email;
      new_user = new Admin({ name, admin_mail, admin_pass });
      console.log(new_user);
    }
    try {
      await new_profile.save();
      await new_user.save();
      res.send("User Added..");
    } catch (err) {
      console.log(err);
    }
  }
});

app.post("/create_assessment", async (req, res) => {
  try {
    const {
      assessment_name,
      total_questions,
      points_per_question,
      passing_marks,
      time_limit,
      start_date,
      end_date,
      published_to,
      employee_emails,
      questions,
    } = req.body;

    const assessmentId = "ASSESS_" + Date.now();
    const total_marks =
      parseInt(total_questions) * parseInt(points_per_question);

    let publishedToArray = [];
    if (published_to === "all") {
      publishedToArray = ["all"];
    } else if (published_to === "specific" && employee_emails) {
      publishedToArray = employee_emails
        .split(",")
        .map((email) => email.trim());
    }

    const processedQuestions = [];
    for (let i = 0; i < total_questions; i++) {
      if (questions[i]) {
        const answerIndex = parseInt(questions[i].answer);
        processedQuestions.push({
          question: questions[i].question,
          options: questions[i].options,
          answer: questions[i].options[answerIndex],
        });
      }
    }
    const newAssessment = new Assessment({
      id: assessmentId,
      assessment_name,
      total_marks,
      passing_marks: parseInt(passing_marks),
      total_questions: parseInt(total_questions),
      start_date: new Date(start_date),
      end_date: new Date(end_date),
      time_limit: parseInt(time_limit),
      published_to: publishedToArray,
      is_published: false,
      assessment: processedQuestions,
    });

    await newAssessment.save();
    if (publishedToArray.includes("all")) {
      const allUsers = await User.find({});
      for (const user of allUsers) {
        user.assessmentsDetails.push({
          id: assessmentId,
          assessment_name,
          startTime: "00:00",
          date: start_date,
          duration: `${time_limit} mins`,
          status: "Not Started",
          total_marks,
          passing_marks: parseInt(passing_marks),
          total_questions: parseInt(total_questions),
          start_date: new Date(start_date),
          end_date: new Date(end_date),
          time_limit: parseInt(time_limit),
          published_to: publishedToArray,
          is_published: false,
        });
        await user.save();
      }
    } else {
      for (const email of publishedToArray) {
        const user = await User.findOne({ emp_mail: email });
        if (user) {
          user.assessmentsDetails.push({
            id: assessmentId,
            assessment_name,
            startTime: "00:00",
            date: start_date,
            duration: `${time_limit} mins`,
            status: "Not Started",
            total_marks,
            passing_marks: parseInt(passing_marks),
            total_questions: parseInt(total_questions),
            start_date: new Date(start_date),
            end_date: new Date(end_date),
            time_limit: parseInt(time_limit),
            published_to: publishedToArray,
            is_published: false,
          });
          await user.save();
        }
      }
    }

    res.redirect("/comp_dashboard");
  } catch (error) {
    console.error("Error creating assessment:", error);
    res.status(500).send("Error creating assessment");
  }
});

app.post("/toggle_publish", async (req, res) => {
  try {
    const { assessment_id, is_published } = req.body;

    const assessment = await Assessment.findOneAndUpdate(
      { id: assessment_id },
      { is_published },
      { new: true }
    );

    if (!assessment) {
      return res.json({ success: false, message: "Assessment not found" });
    }

    await User.updateMany(
      { "assessmentsDetails.id": assessment_id },
      { $set: { "assessmentsDetails.$.is_published": is_published } }
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Error toggling publish status:", error);
    res.json({ success: false, message: "Server error" });
  }
});

app.get("/assessment/:id", async (req, res) => {
  const assessmentId = req.params.id;
  const user = await User.findOne({ "assessmentsDetails.id": assessmentId });
  //   console.log(user)
  if (user) {
    const assessment = user.assessmentsDetails.find(
      (a) => a.id === assessmentId
    );
    if (assessment) {
      res.render("assessmentsDetails", { assessment, user });
    } else {
      res.status(404).send("Assessment not found.");
    }
  } else {
    res.status(404).send("User not found.");
  }
});

app.get("/assessment/test/:id/:user_email", async (req, res) => {
  const id = req.params.id;
  const user_email = req.params.user_email;
  const assessment = await Assessment.findOne({ id });

  if (!assessment) return res.status(404).send("Assessment not found.");

  if (!assessment.is_published) {
    return res.status(403).send("Assessment is not published yet.");
  }

  const currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0); // Normalize to start of day

  const startDate = new Date(assessment.start_date);
  const endDate = new Date(assessment.end_date);
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);

  if (currentDate < startDate) {
    return res.status(403).send("Assessment is not yet available.");
  }

  if (currentDate > endDate) {
    return res.status(403).send("Assessment has expired.");
  }

  const user = await User.findOne({ emp_mail: user_email });
  if (user) {
    const userAssessment = user.assessmentsDetails.find((a) => a.id === id);
    if (userAssessment && userAssessment.status === "Completed") {
      return res.status(403).send("You have already completed this assessment.");
    }
  }

  res.render("assessment_test", { assessment, user_email });
});


app.post("/submit_assessment", async (req, res) => {
  try {
    const { assessment_id, user_email, answers } = req.body;

    const assessment = await Assessment.findOne({ id: assessment_id });
    if (!assessment) {
      return res.status(404).send("Assessment not found");
    }

    const user = await User.findOne({ emp_mail: user_email });
    if (!user) {
      return res.status(404).send("User not found");
    }

    const userAssessment = user.assessmentsDetails.find(
      (a) => a.id === assessment_id
    );
    if (userAssessment && userAssessment.status === "Completed") {
      return res.status(403).send("Assessment already completed");
    }

    let score = 0;
    let totalQuestions = assessment.assessment.length;

    for (let i = 0; i < totalQuestions; i++) {
      if (answers && answers[i] !== undefined) {
        const selectedOptionIndex = parseInt(answers[i]);
        const correctAnswer = assessment.assessment[i].answer;
        const selectedAnswer =
          assessment.assessment[i].options[selectedOptionIndex];

        if (selectedAnswer === correctAnswer) {
          score++;
        }
      }
    }

    const totalMarks = assessment.total_marks;
    const obtainedMarks = Math.round((score / totalQuestions) * totalMarks);
    const percentage = Math.round((obtainedMarks / totalMarks) * 100);
    const passed = obtainedMarks >= assessment.passing_marks;

    const result = {
      assessment_id,
      assessment_name: assessment.assessment_name,
      total_questions: totalQuestions,
      correct_answers: score,
      total_marks: totalMarks,
      obtained_marks: obtainedMarks,
      passing_marks: assessment.passing_marks,
      percentage,
      passed,
      submitted_at: new Date(),
    };

    await User.updateOne(
      {
        emp_mail: user_email,
        "assessmentsDetails.id": assessment_id,
      },
      {
        $set: {
          "assessmentsDetails.$.status": "Completed",
          "assessmentsDetails.$.result": result,
        },
      }
    );

    res.render("assessment_result", { result, assessment, user_email });
  } catch (error) {
    console.error("Error submitting assessment:", error);
    res.status(500).send("Error submitting assessment");
  }
});

app.delete("/delete_assessment/:id", async (req, res) => {
  const assessmentId = req.params.id;
  try {
    await Assessment.deleteOne({ id: assessmentId });
    await User.updateMany(
      {},
      { $pull: { assessmentsDetails: { id: assessmentId } } }
    );
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting assessment:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});
