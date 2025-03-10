-- Enable pgcrypto extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Clean existing data
DELETE FROM validations;
DELETE FROM data_statistics;
DELETE FROM model_checkpoints;

-- Seed models data
-- DeepLabV3+ Segmentation Model
WITH model_data AS (
  SELECT
    encode(digest('DeepLabV3+ Segmentation Model', 'sha256'), 'hex') as checkpoint_id,
    'DeepLabV3+ Segmentation Model' as model_name,
    'https://github.com/tensorflow/models/tree/master/research/deeplab' as model_url,
    'Advanced semantic segmentation model based on DeepLabV3+ architecture with enhanced atrous spatial pyramid pooling' as description,
    jsonb_build_object(
      'applicabilityCriteria', jsonb_build_array(
        'High-resolution medical imaging data',
        'Minimum input resolution of 512x512 pixels',
        'RGB or grayscale input formats'
      ),
      'primaryIntendedUse', 'Medical image segmentation for tumor detection and organ boundary delineation',
      'users', jsonb_build_object(
        'intendedUsers', jsonb_build_array('Medical imaging specialists', 'Radiologists', 'Clinical researchers'),
        'requiredExpertise', 'Advanced knowledge in medical imaging and basic ML model deployment'
      ),
      'reference', jsonb_build_object(
        'paper', 'https://arxiv.org/abs/1802.02611',
        'codeRepository', 'https://github.com/tensorflow/models/tree/master/research/deeplab',
        'documentation', 'https://github.com/tensorflow/models/blob/master/research/deeplab/g3doc/model_zoo.md'
      ),
      'datasetRequirements', jsonb_build_object(
        'format', 'DICOM or NIfTI',
        'minimumSamples', 1000,
        'annotations', 'Pixel-level segmentation masks',
        'preprocessing', 'Intensity normalization and standard slice thickness'
      ),
      'metricsAndValidation', jsonb_build_object(
        'metrics', jsonb_build_object(
          'diceCoefficient', 0.92,
          'meanIoU', 0.89,
          'precision', 0.94,
          'recall', 0.91
        ),
        'validationDataset', 'MICCAI 2023 Challenge Dataset',
        'crossValidation', '5-fold cross-validation'
      )
    ) as metadata
)
INSERT INTO model_checkpoints (checkpoint_id, fair_model_id, fair_model_url, metadata, description)
SELECT checkpoint_id, model_name, model_url, metadata, description
FROM model_data;

-- Insert validation for DeepLabV3+
INSERT INTO validations (model_checkpoint_id, fair_model_id, validation_status, validation_result, start_datetime)
SELECT
  encode(digest('DeepLabV3+ Segmentation Model', 'sha256'), 'hex'),
  'DeepLabV3+ Segmentation Model',
  'completed',
  jsonb_build_object(
    'metrics', jsonb_build_object(
      'diceCoefficient', 0.92,
      'meanIoU', 0.89,
      'precision', 0.94,
      'recall', 0.91
    ),
    'validationDataset', 'MICCAI 2023 Challenge Dataset',
    'crossValidation', '5-fold cross-validation'
  ),
  NOW();

-- Insert data statistics for DeepLabV3+
INSERT INTO data_statistics (hash, statistics, data_type, additional_desc)
SELECT
  encode(digest('DeepLabV3+ Segmentation Model_stats', 'sha256'), 'hex'),
  jsonb_build_object(
    'diceCoefficient', 0.92,
    'meanIoU', 0.89,
    'precision', 0.94,
    'recall', 0.91
  ),
  'training',
  'Training data statistics for DeepLabV3+ Segmentation Model';

-- LightGBM Time Series Forecaster
WITH model_data AS (
  SELECT
    encode(digest('LightGBM Time Series Forecaster', 'sha256'), 'hex') as checkpoint_id,
    'LightGBM Time Series Forecaster' as model_name,
    'https://github.com/microsoft/LightGBM' as model_url,
    'Gradient boosting framework optimized for time series forecasting with custom feature engineering' as description,
    jsonb_build_object(
      'applicabilityCriteria', jsonb_build_array(
        'Temporal data with minimum 1000 timestamps',
        'Regular time intervals required',
        'Supports multiple seasonality patterns'
      ),
      'primaryIntendedUse', 'Energy consumption forecasting and demand prediction',
      'users', jsonb_build_object(
        'intendedUsers', jsonb_build_array('Data scientists', 'Energy analysts', 'Utility companies'),
        'requiredExpertise', 'Time series analysis and feature engineering'
      ),
      'reference', jsonb_build_object(
        'paper', 'https://papers.nips.cc/paper/6907-lightgbm-a-highly-efficient-gradient-boosting',
        'codeRepository', 'https://github.com/microsoft/LightGBM',
        'documentation', 'https://lightgbm.readthedocs.io/en/latest/'
      ),
      'datasetRequirements', jsonb_build_object(
        'format', 'CSV with timestamp column',
        'minimumSamples', '1000 time points',
        'features', 'At least 3 numerical features',
        'preprocessing', 'Handling missing values and outliers'
      ),
      'metricsAndValidation', jsonb_build_object(
        'metrics', jsonb_build_object(
          'mape', 4.2,
          'rmse', 0.087,
          'mae', 0.065,
          'r2Score', 0.93
        ),
        'validationDataset', 'Public utility data 2022-2023',
        'crossValidation', 'Time series walk-forward validation'
      )
    ) as metadata
)
INSERT INTO model_checkpoints (checkpoint_id, fair_model_id, fair_model_url, metadata, description)
SELECT checkpoint_id, model_name, model_url, metadata, description
FROM model_data;

-- Insert validation for LightGBM
INSERT INTO validations (model_checkpoint_id, fair_model_id, validation_status, validation_result, start_datetime)
SELECT
  encode(digest('LightGBM Time Series Forecaster', 'sha256'), 'hex'),
  'LightGBM Time Series Forecaster',
  'completed',
  jsonb_build_object(
    'metrics', jsonb_build_object(
      'mape', 4.2,
      'rmse', 0.087,
      'mae', 0.065,
      'r2Score', 0.93
    ),
    'validationDataset', 'Public utility data 2022-2023',
    'crossValidation', 'Time series walk-forward validation'
  ),
  NOW();

-- Insert data statistics for LightGBM
INSERT INTO data_statistics (hash, statistics, data_type, additional_desc)
SELECT
  encode(digest('LightGBM Time Series Forecaster_stats', 'sha256'), 'hex'),
  jsonb_build_object(
    'mape', 4.2,
    'rmse', 0.087,
    'mae', 0.065,
    'r2Score', 0.93
  ),
  'training',
  'Training data statistics for LightGBM Time Series Forecaster';

-- Insert additional validations for LightGBM Time Series Forecaster (Industrial IoT)
INSERT INTO validations (model_checkpoint_id, fair_model_id, validation_status, validation_result, start_datetime)
SELECT
  encode(digest('LightGBM Time Series Forecaster', 'sha256'), 'hex'),
  'LightGBM Time Series Forecaster',
  'running',
  jsonb_build_object(
    'metrics', jsonb_build_object(
      'mape', 3.8,
      'rmse', 0.072,
      'mae', 0.058,
      'r2Score', 0.95
    ),
    'validationDataset', 'Industrial IoT sensor data 2023-2024',
    'crossValidation', 'Sequential time series validation'
  ),
  NOW() - interval '2 hours';

-- Insert failed validation for LightGBM (Financial Market Data)
INSERT INTO validations (model_checkpoint_id, fair_model_id, validation_status, validation_result, start_datetime)
SELECT
  encode(digest('LightGBM Time Series Forecaster', 'sha256'), 'hex'),
  'LightGBM Time Series Forecaster',
  'failed',
  jsonb_build_object(
    'metrics', jsonb_build_object(
      'mape', 12.5,
      'rmse', 0.245,
      'mae', 0.198,
      'r2Score', 0.67
    ),
    'validationDataset', 'Financial market data 2023',
    'crossValidation', 'Time series walk-forward validation',
    'failureReason', 'Performance metrics below acceptable thresholds for financial forecasting'
  ),
  NOW() - interval '1 day';

-- Insert completed validation for LightGBM (Weather Data)
INSERT INTO validations (model_checkpoint_id, fair_model_id, validation_status, validation_result, start_datetime)
SELECT
  encode(digest('LightGBM Time Series Forecaster', 'sha256'), 'hex'),
  'LightGBM Time Series Forecaster',
  'completed',
  jsonb_build_object(
    'metrics', jsonb_build_object(
      'mape', 4.5,
      'rmse', 0.092,
      'mae', 0.071,
      'r2Score', 0.91
    ),
    'validationDataset', 'Weather forecasting data 2022-2024',
    'crossValidation', 'Rolling window validation'
  ),
  NOW() - interval '12 hours';

-- BERT-Based Text Classifier
WITH model_data AS (
  SELECT
    encode(digest('BERT-Based Text Classifier', 'sha256'), 'hex') as checkpoint_id,
    'BERT-Based Text Classifier' as model_name,
    'https://github.com/google-research/bert' as model_url,
    'Fine-tuned BERT model for multi-label document classification with domain adaptation' as description,
    jsonb_build_object(
      'applicabilityCriteria', jsonb_build_array(
        'Text documents in supported languages (EN, ES, FR)',
        'Maximum sequence length of 512 tokens',
        'Plain text or HTML format'
      ),
      'primaryIntendedUse', 'Scientific publication classification and topic modeling',
      'users', jsonb_build_object(
        'intendedUsers', jsonb_build_array('Research librarians', 'Content managers', 'Academic institutions'),
        'requiredExpertise', 'Basic NLP knowledge and data preprocessing skills'
      ),
      'reference', jsonb_build_object(
        'paper', 'https://arxiv.org/abs/1810.04805',
        'codeRepository', 'https://github.com/google-research/bert',
        'documentation', 'https://huggingface.co/docs/transformers/model_doc/bert'
      ),
      'datasetRequirements', jsonb_build_object(
        'format', 'TXT or JSON',
        'minimumSamples', '10000 documents',
        'labeling', 'Multi-label classification schema',
        'preprocessing', 'Text cleaning and tokenization'
      ),
      'metricsAndValidation', jsonb_build_object(
        'metrics', jsonb_build_object(
          'f1Score', 0.88,
          'accuracy', 0.91,
          'precision', 0.89,
          'recall', 0.87
        ),
        'validationDataset', 'arXiv papers 2020-2023',
        'crossValidation', 'Stratified 5-fold'
      )
    ) as metadata
)
INSERT INTO model_checkpoints (checkpoint_id, fair_model_id, fair_model_url, metadata, description)
SELECT checkpoint_id, model_name, model_url, metadata, description
FROM model_data;

-- Insert validation for BERT
INSERT INTO validations (model_checkpoint_id, fair_model_id, validation_status, validation_result, start_datetime)
SELECT
  encode(digest('BERT-Based Text Classifier', 'sha256'), 'hex'),
  'BERT-Based Text Classifier',
  'running',
  jsonb_build_object(
    'metrics', jsonb_build_object(
      'f1Score', 0.88,
      'accuracy', 0.91,
      'precision', 0.89,
      'recall', 0.87
    ),
    'validationDataset', 'arXiv papers 2020-2023',
    'crossValidation', 'Stratified 5-fold'
  ),
  NOW();

-- Insert data statistics for BERT
INSERT INTO data_statistics (hash, statistics, data_type, additional_desc)
SELECT
  encode(digest('BERT-Based Text Classifier_stats', 'sha256'), 'hex'),
  jsonb_build_object(
    'f1Score', 0.88,
    'accuracy', 0.91,
    'precision', 0.89,
    'recall', 0.87
  ),
  'training',
  'Training data statistics for BERT-Based Text Classifier';

-- ResNet50 Transfer Learning Model
WITH model_data AS (
  SELECT
    encode(digest('ResNet50 Transfer Learning Model', 'sha256'), 'hex') as checkpoint_id,
    'ResNet50 Transfer Learning Model' as model_name,
    'https://github.com/keras-team/keras-applications' as model_url,
    'Transfer learning implementation of ResNet50 for specialized image classification' as description,
    jsonb_build_object(
      'applicabilityCriteria', jsonb_build_array(
        'RGB images only',
        'Minimum resolution 224x224',
        'Maximum batch size of 32'
      ),
      'primaryIntendedUse', 'Industrial quality control and defect detection',
      'users', jsonb_build_object(
        'intendedUsers', jsonb_build_array('Quality control engineers', 'Manufacturing specialists', 'Production line managers'),
        'requiredExpertise', 'Computer vision basics and model deployment knowledge'
      ),
      'reference', jsonb_build_object(
        'paper', 'https://arxiv.org/abs/1512.03385',
        'codeRepository', 'https://github.com/keras-team/keras-applications',
        'documentation', 'https://keras.io/api/applications/resnet/'
      ),
      'datasetRequirements', jsonb_build_object(
        'format', 'JPG or PNG',
        'minimumSamples', '5000 per class',
        'annotations', 'Binary classification labels',
        'preprocessing', 'Resize and normalization'
      ),
      'metricsAndValidation', jsonb_build_object(
        'metrics', jsonb_build_object(
          'accuracy', 0.95,
          'precision', 0.94,
          'recall', 0.93,
          'f1Score', 0.935
        ),
        'validationDataset', 'Industrial defect dataset 2023',
        'crossValidation', '3-fold cross-validation'
      )
    ) as metadata
)
INSERT INTO model_checkpoints (checkpoint_id, fair_model_id, fair_model_url, metadata, description)
SELECT checkpoint_id, model_name, model_url, metadata, description
FROM model_data;

-- Insert validation for ResNet50
INSERT INTO validations (model_checkpoint_id, fair_model_id, validation_status, validation_result, start_datetime)
SELECT
  encode(digest('ResNet50 Transfer Learning Model', 'sha256'), 'hex'),
  'ResNet50 Transfer Learning Model',
  'failed',
  jsonb_build_object(
    'metrics', jsonb_build_object(
      'accuracy', 0.95,
      'precision', 0.94,
      'recall', 0.93,
      'f1Score', 0.935
    ),
    'validationDataset', 'Industrial defect dataset 2023',
    'crossValidation', '3-fold cross-validation'
  ),
  NOW();

-- Insert data statistics for ResNet50
INSERT INTO data_statistics (hash, statistics, data_type, additional_desc)
SELECT
  encode(digest('ResNet50 Transfer Learning Model_stats', 'sha256'), 'hex'),
  jsonb_build_object(
    'accuracy', 0.95,
    'precision', 0.94,
    'recall', 0.93,
    'f1Score', 0.935
  ),
  'training',
  'Training data statistics for ResNet50 Transfer Learning Model';
