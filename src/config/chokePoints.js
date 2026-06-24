export const CHOKE_POINTS = {
  strait_of_hormuz: {
    name: "Strait of Hormuz",
    bbox: [[25.0, 54.0], [27.5, 57.5]],
    center: [26.3, 55.8],
    description: "Connects the Persian Gulf with the Gulf of Oman. Main corridor for Middle East crude exports to Asia.",
    riskLevel: "CRITICAL",
    riskScore: 78
  },
  bab_el_mandeb: {
    name: "Bab el-Mandeb (Red Sea)",
    bbox: [[11.5, 42.0], [14.5, 44.5]],
    center: [12.8, 43.3],
    description: "Choke point between Yemen and Djibouti. Connects the Red Sea to the Gulf of Aden.",
    riskLevel: "HIGH",
    riskScore: 65
  },
  suez_canal: {
    name: "Suez Canal",
    bbox: [[29.5, 32.0], [31.5, 33.0]],
    center: [30.5, 32.5],
    description: "Artificial sea-level waterway in Egypt. Primary route from the Middle East/Asia to Europe.",
    riskLevel: "MEDIUM",
    riskScore: 42
  },
  strait_of_malacca: {
    name: "Strait of Malacca",
    bbox: [[1.0, 101.0], [6.0, 105.0]],
    center: [3.5, 102.5],
    description: "Links the Indian Ocean with the South China Sea. Primary transit corridor to East Asia/India West Coast.",
    riskLevel: "LOW",
    riskScore: 28
  }
};
