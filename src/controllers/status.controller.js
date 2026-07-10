export const getStatus = async (req, res) => {
  try {
    return res.status(200).json({
      status: "Online",
      model_chronos: "Chronos-T5 Tiny",
      model_gbr: "Gradient Boosting Regressor",
      calibrated: true
    });
  } catch (error) {
    return res.status(503).json({
      status: "Offline",
      message: "Model AI sedang loading atau gagal dimuat."
    });
  }
};