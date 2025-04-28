import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000'; // Replace with your backend's IP or domain when deployed

export const createStudySession = async (sessionData) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/sessions`, sessionData);
    return response.data;
  } catch (error) {
    console.error('❌ Error creating session:', error);
    throw error;
  }
};