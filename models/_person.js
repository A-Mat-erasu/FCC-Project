// Shared base fields (mirrors abstract class Person in the Java engine)
const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const personFields = {
  firstName: { type: String, required: true, trim: true },
  lastName:  { type: String, required: true, trim: true },
  dob:       { type: Date, required: true },
  gender:    { type: String, enum: ['MALE', 'FEMALE', 'OTHER'], required: true },
  bloodType: { type: String, enum: BLOOD_TYPES, required: true },
  phone:     { type: String, required: true, match: /^[0-9+\-\s]{7,15}$/ }
};
module.exports = { BLOOD_TYPES, personFields };
