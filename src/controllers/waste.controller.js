import prisma from '../config/db.js';

export const getAllWaste = async (req, res) => {
  try {
    const wastes = await prisma.waste.findMany();
    res.status(200).json({ success: true, data: wastes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createWaste = async (req, res) => {
  const { type, weight } = req.body;
  try {
    const newWaste = await prisma.waste.create({    
      data: { type, weight: parseFloat(weight) }
    });
    res.status(201).json({ success: true, data: newWaste });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};