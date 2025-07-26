  const mongoose = require("mongoose");

  const assessmentDetailsSchema = new mongoose.Schema({
    id: String,
    assessment_name: String,
    startTime: String,
    date: String,
    duration: String,
    status: String,
    total_marks: Number,
    passing_marks: Number,
    total_questions: Number,
    start_date: Date,
    end_date: Date,
    time_limit: Number,
    published_to: [String],
    is_published: Boolean,
  });

  const userSchema = new mongoose.Schema({
    name: String,
    emp_mail: String,
    emp_pass: String,
    assessmentsDetails: [assessmentDetailsSchema],
  });
  const User = mongoose.model("User", userSchema);

  const adminSchema = new mongoose.Schema({
    name:String,
    admin_mail: String,
    admin_pass: String,
  });
  const Admin = mongoose.model("Admin", adminSchema);

  const profileSchema = new mongoose.Schema({
    name: String,
    emp_id: String,
    email: String,
    pass: String,
    // confirmpass:String,
    gender: String,
    phone: String,
    date: Date,
    user_type: String,
  });
  const Profile = mongoose.model("Profile", profileSchema);

  const questionSchema = new mongoose.Schema(
      {
          question: String,
          options:[String],
          answer: String,
      }
  );
  const assessmentsSchema = new mongoose.Schema(
      {
          id : String,
          assessment_name: String,
          total_marks: Number,
          passing_marks: Number,
          total_questions: Number,
          start_date: Date,
          end_date: Date,
          time_limit: Number,
          published_to: [String],
          is_published: Boolean,
          assessment : [questionSchema]
      }
  );
  const Assessment = mongoose.model('assessment',assessmentsSchema);
  module.exports = { User, Admin, Profile, Assessment};
