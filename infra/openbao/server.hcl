ui = false
api_addr = "https://endpoint-secrets:8200"
cluster_addr = "https://endpoint-secrets:8201"
storage "raft" {
  path = "/bao/data"
  node_id = "endpoint-development-1"
}
listener "tcp" {
  address = "0.0.0.0:8200"
  cluster_address = "0.0.0.0:8201"
  tls_cert_file = "/bao/tls/server.crt"
  tls_key_file = "/bao/tls/server.key"
  tls_min_version = "tls12"
  disable_unauthed_generate_root_endpoints = true
}
log_level = "warn"
audit "file" "endpoint" {
  options {
    file_path = "/bao/audit/endpoint.json"
    log_raw = "false"
  }
}
