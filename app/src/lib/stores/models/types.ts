// Database row types
export interface DBModelRow {
  checkpoint_id: string;
  fair_model_id: string;
  fair_model_url: string;
  metadata: ModelMetadata;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface DBModelWithValidationRow extends DBModelRow {
  validation_count: string;
  latest_validation_date: string | null;
  latest_validation_status: 'pending' | 'running' | 'completed' | 'failed' | null;
}

export interface ValidationRow {
  val_id: number;
  validation_status: 'pending' | 'running' | 'completed' | 'failed';
  start_datetime: string;
  end_datetime: string | null;
  description: string | null;
  validation_dataset: string | null;
  validation_result: any;
  user_id: number | null;
  model_checkpoint_id: string;
  fair_model_id: string;
  fairvor_val_lib_version?: string;
  created_at: string;
  updated_at: string;
}

export interface ModelMetadata {
  applicabilityCriteria: string[];
  primaryIntendedUse: string;
  users: {
    intendedUsers: string[];
    requiredExpertise: string;
  };
  reference: {
    paper: string;
    codeRepository: string;
    documentation: string;
  };
  datasetRequirements: {
    format: string;
    minimumSamples: string | number;
    annotations?: string;
    preprocessing?: string;
  };
  metricsAndValidation: {
    metrics: Record<string, number>;
    validationDataset: string;
    crossValidation: string;
  };
}

export interface ValidationDetails {
  val_id: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  start_date: string;
  end_date: string | null;
  description: string | null;
  dataset: string | null;
  result: any;
  user_id: number | null;
}

export interface Model {
  checkpoint_id: string;
  fair_model_id: string;
  fair_model_url: string;
  metadata: ModelMetadata;
  description: string;
  created_at: string;
  updated_at: string;
  validations?: {
    count: number;
    latest?: {
      status: 'pending' | 'running' | 'completed' | 'failed';
      date: string;
    };
    all?: ValidationDetails[];
  };
}
