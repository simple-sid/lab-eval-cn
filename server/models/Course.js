import mongoose from 'mongoose';

const courseSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  semester: { type: String, required: true },
  parameters: { type: Object, default: {} }, // Dynamic fields for question form
  modules: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Module' }]
});

export default mongoose.model('Course', courseSchema);
