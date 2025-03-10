// Mock API for validation
import data from './validation.json'
export const validateModel = async (model: any) => {
  return {
    data,
    valid: true,
    errors: []
  };
};