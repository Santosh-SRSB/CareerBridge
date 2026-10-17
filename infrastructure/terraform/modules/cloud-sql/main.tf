# Terraform Module: Cloud SQL PostgreSQL
variable "instance_name" {
  type        = string
  description = "Cloud SQL Instance Name"
}

variable "database_version" {
  type        = string
  default     = "POSTGRES_16"
}
