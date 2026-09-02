# Terraform Module: Cloud Tasks Queue
variable "queue_name" {
  type        = string
  description = "Cloud Tasks Queue Name"
}

variable "location" {
  type        = string
  default     = "asia-south1"
}
