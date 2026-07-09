
class WastePredictionService {
  static #instance = null;
  #apiUrl;

  constructor() {
    if (WastePredictionService.#instance) {
      throw new Error("Gunakan WastePredictionService.getInstance() untuk mengambil instansi.");
    }
    this.#apiUrl = process.env.API_URL || "";
  }

  static getInstance() {
    if (!WastePredictionService.#instance) {
      WastePredictionService.#instance = new WastePredictionService();
    }
    return WastePredictionService.#instance;
  }

  async predict(payload) {
    const response = await fetch(this.#apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI API Error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }
}

// Export instansi tunggalnya (Singleton)
export const wasteService = WastePredictionService.getInstance();