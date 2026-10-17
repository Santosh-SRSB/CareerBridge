# Terraform Module: Cloud Storage Bucket
variable "bucket_name" {
  type        = string
  description = "GCS bucket name"
}

variable "location" {
  type        = string
  default     = "ASIA-SOUTH1"
}
