export const models = [
  {
    name: 'DeepLabV3+ Segmentation Model',
    description: 'Advanced semantic segmentation model based on DeepLabV3+ architecture with enhanced atrous spatial pyramid pooling',
    applicabilityCriteria: [
      'High-resolution medical imaging data',
      'Minimum input resolution of 512x512 pixels',
      'RGB or grayscale input formats'
    ],
    primaryIntendedUse: 'Medical image segmentation for tumor detection and organ boundary delineation',
    users: {
      intendedUsers: ['Medical imaging specialists', 'Radiologists', 'Clinical researchers'],
      requiredExpertise: 'Advanced knowledge in medical imaging and basic ML model deployment'
    },
    reference: {
      paper: 'https://arxiv.org/abs/1802.02611',
      codeRepository: 'https://github.com/tensorflow/models/tree/master/research/deeplab',
      documentation: 'https://github.com/tensorflow/models/blob/master/research/deeplab/g3doc/model_zoo.md'
    },
    datasetRequirements: {
      format: 'DICOM or NIfTI',
      minimumSamples: 1000,
      annotations: 'Pixel-level segmentation masks',
      preprocessing: 'Intensity normalization and standard slice thickness'
    },
    metricsAndValidation: {
      metrics: {
        diceCoefficient: 0.92,
        meanIoU: 0.89,
        precision: 0.94,
        recall: 0.91
      },
      validationDataset: 'MICCAI 2023 Challenge Dataset',
      crossValidation: '5-fold cross-validation'
    },
    validations: 4,
    lastValidation: '12 May 2024',
    status: 'Done'
  },
  {
    name: 'LightGBM Time Series Forecaster',
    description: 'Gradient boosting framework optimized for time series forecasting with custom feature engineering',
    applicabilityCriteria: [
      'Temporal data with minimum 1000 timestamps',
      'Regular time intervals required',
      'Supports multiple seasonality patterns'
    ],
    primaryIntendedUse: 'Energy consumption forecasting and demand prediction',
    users: {
      intendedUsers: ['Data scientists', 'Energy analysts', 'Utility companies'],
      requiredExpertise: 'Time series analysis and feature engineering'
    },
    reference: {
      paper: 'https://papers.nips.cc/paper/6907-lightgbm-a-highly-efficient-gradient-boosting',
      codeRepository: 'https://github.com/microsoft/LightGBM',
      documentation: 'https://lightgbm.readthedocs.io/en/latest/'
    },
    datasetRequirements: {
      format: 'CSV with timestamp column',
      minimumSamples: '1000 time points',
      features: 'At least 3 numerical features',
      preprocessing: 'Handling missing values and outliers'
    },
    metricsAndValidation: {
      metrics: {
        mape: 4.2,
        rmse: 0.087,
        mae: 0.065,
        r2Score: 0.93
      },
      validationDataset: 'Public utility data 2022-2023',
      crossValidation: 'Time series walk-forward validation'
    },
    validations: 6,
    lastValidation: '12 May 2024',
    status: 'Done'
  },
  {
    name: 'BERT-Based Text Classifier',
    description: 'Fine-tuned BERT model for multi-label document classification with domain adaptation',
    applicabilityCriteria: [
      'Text documents in supported languages (EN, ES, FR)',
      'Maximum sequence length of 512 tokens',
      'Plain text or HTML format'
    ],
    primaryIntendedUse: 'Scientific publication classification and topic modeling',
    users: {
      intendedUsers: ['Research librarians', 'Content managers', 'Academic institutions'],
      requiredExpertise: 'Basic NLP knowledge and data preprocessing skills'
    },
    reference: {
      paper: 'https://arxiv.org/abs/1810.04805',
      codeRepository: 'https://github.com/google-research/bert',
      documentation: 'https://huggingface.co/docs/transformers/model_doc/bert'
    },
    datasetRequirements: {
      format: 'TXT or JSON',
      minimumSamples: '10000 documents',
      labeling: 'Multi-label classification schema',
      preprocessing: 'Text cleaning and tokenization'
    },
    metricsAndValidation: {
      metrics: {
        f1Score: 0.88,
        accuracy: 0.91,
        precision: 0.89,
        recall: 0.87
      },
      validationDataset: 'arXiv papers 2020-2023',
      crossValidation: 'Stratified 5-fold'
    },
    validations: 2,
    lastValidation: '12 May 2024',
    status: 'In progress (23 min)'
  },
  {
    name: 'ResNet50 Transfer Learning Model',
    description: 'Transfer learning implementation of ResNet50 for specialized image classification',
    applicabilityCriteria: [
      'RGB images only',
      'Minimum resolution 224x224',
      'Maximum batch size of 32'
    ],
    primaryIntendedUse: 'Industrial quality control and defect detection',
    users: {
      intendedUsers: ['Quality control engineers', 'Manufacturing specialists', 'Production line managers'],
      requiredExpertise: 'Computer vision basics and model deployment knowledge'
    },
    reference: {
      paper: 'https://arxiv.org/abs/1512.03385',
      codeRepository: 'https://github.com/keras-team/keras-applications',
      documentation: 'https://keras.io/api/applications/resnet/'
    },
    datasetRequirements: {
      format: 'JPG or PNG',
      minimumSamples: '5000 per class',
      annotations: 'Binary classification labels',
      preprocessing: 'Resize and normalization'
    },
    metricsAndValidation: {
      metrics: {
        accuracy: 0.95,
        precision: 0.94,
        recall: 0.93,
        f1Score: 0.935
      },
      validationDataset: 'Industrial defect dataset 2023',
      crossValidation: '3-fold cross-validation'
    },
    validations: 3,
    lastValidation: '12 May 2024',
    status: 'Failed'
  }
]
