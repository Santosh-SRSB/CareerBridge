# Terraform Module: Cloud Run Service
variable "service_name" {
  type        = string
  description = "The name of the Cloud Run service"
}

variable "image" {
  type        = string
  description = "Container image URL"
}

variable "region" {
  type        = string
  default     = "asia-south1"
}
