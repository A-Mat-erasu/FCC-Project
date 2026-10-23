require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { connectDB } = require('./config/db');
const { User, Donor, Patient, Organ, TransplantRequest, Allocation } = require('./models');

async function seed() {
  await connectDB();
  console.log('[Seed] Connected to database');

  // Check or create users
  const users = [
    { username: 'admin', password: 'admin123', role: 'ADMIN', phone: '+91 98765 00001' },
    { username: 'coordinator1', password: 'coord123', role: 'COORDINATOR', phone: '+91 98765 00002' },
    { username: 'dr_sharma', password: 'doctor123', role: 'VIEWER', phone: '+91 98765 00003' }
  ];

  for (const u of users) {
    const exists = await User.findOne({ username: u.username });
    if (!exists) {
      await User.create({
        username: u.username,
        passwordHash: await bcrypt.hash(u.password, 10),
        role: u.role
      });
      console.log(`[Seed] Created user: ${u.username} (${u.role})`);
    }
  }

  // Check donors
  const donorCount = await Donor.countDocuments();
  if (donorCount === 0) {
    const donors = await Donor.create([
      { firstName: 'Aarav', lastName: 'Patel', dob: new Date('1988-04-12'), gender: 'MALE', bloodType: 'O-', phone: '9876543211', donorType: 'DECEASED', consentVerified: true },
      { firstName: 'Sunita', lastName: 'Rao', dob: new Date('1992-09-23'), gender: 'FEMALE', bloodType: 'A+', phone: '9876543212', donorType: 'DECEASED', consentVerified: true },
      { firstName: 'Vikram', lastName: 'Mehta', dob: new Date('1980-01-15'), gender: 'MALE', bloodType: 'B+', phone: '9876543213', donorType: 'LIVING', consentVerified: true },
      { firstName: 'Priya', lastName: 'Nair', dob: new Date('1995-11-05'), gender: 'FEMALE', bloodType: 'AB+', phone: '9876543214', donorType: 'DECEASED', consentVerified: false }
    ]);
    console.log(`[Seed] Created ${donors.length} donors`);

    // Create patients
    const patients = await Patient.create([
      { firstName: 'Rahul', lastName: 'Verma', dob: new Date('1975-03-10'), gender: 'MALE', bloodType: 'O-', phone: '9123456781', medicalCondition: 'End-Stage Renal Disease', hospital: 'Apollo Multi-Specialty' },
      { firstName: 'Ananya', lastName: 'Sen', dob: new Date('1982-07-19'), gender: 'FEMALE', bloodType: 'A+', phone: '9123456782', medicalCondition: 'Dilated Cardiomyopathy', hospital: 'Fortis Memorial Hospital' },
      { firstName: 'Kabir', lastName: 'Singh', dob: new Date('1990-12-01'), gender: 'MALE', bloodType: 'AB+', phone: '9123456783', medicalCondition: 'Acute Hepatic Failure', hospital: 'Max Super Healthcare' },
      { firstName: 'Meera', lastName: 'Deshmukh', dob: new Date('1968-06-25'), gender: 'FEMALE', bloodType: 'B+', phone: '9123456784', medicalCondition: 'Bilateral Pulmonary Fibrosis', hospital: 'Manipal Hospital' }
    ]);
    console.log(`[Seed] Created ${patients.length} patients`);

    // Create organs
    const organ1 = await Organ.create({
      donor: donors[0]._id,
      organType: 'KIDNEY',
      bloodType: 'O-',
      harvestDatetime: new Date(Date.now() - 3600 * 1000 * 4), // 4h ago
      viabilityHours: 24
    });

    const organ2 = await Organ.create({
      donor: donors[1]._id,
      organType: 'HEART',
      bloodType: 'A+',
      harvestDatetime: new Date(Date.now() - 3600 * 1000 * 1.5), // 1.5h ago
      viabilityHours: 4
    });

    const organ3 = await Organ.create({
      donor: donors[0]._id,
      organType: 'LIVER',
      bloodType: 'O-',
      harvestDatetime: new Date(Date.now() - 3600 * 1000 * 2), // 2h ago
      viabilityHours: 12
    });

    console.log('[Seed] Created 3 live organs');

    // Create transplant requests (waitlist)
    await TransplantRequest.create([
      { patient: patients[0]._id, organType: 'KIDNEY', urgency: 5, listingDate: new Date(Date.now() - 86400000 * 30), status: 'WAITING' },
      { patient: patients[1]._id, organType: 'HEART', urgency: 5, listingDate: new Date(Date.now() - 86400000 * 14), status: 'WAITING' },
      { patient: patients[2]._id, organType: 'LIVER', urgency: 4, listingDate: new Date(Date.now() - 86400000 * 45), status: 'WAITING' },
      { patient: patients[3]._id, organType: 'LUNG', urgency: 3, listingDate: new Date(Date.now() - 86400000 * 60), status: 'WAITING' }
    ]);
    console.log('[Seed] Created 4 waitlist requests');
  }

  await mongoose.disconnect();
  console.log('[Seed] Database seeding completed successfully');
}

seed().catch(console.error);
