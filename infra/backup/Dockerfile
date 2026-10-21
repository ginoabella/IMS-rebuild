# Candidate tooling only; no credentials, scheduler, retained activation or network at runtime.
FROM node:22.23.3-bookworm-slim@sha256:43ac6c60b8f89723f746e8a92ce91abd5017e627ce1ddfe4238355d3a30b772c AS age
ADD --checksum=sha256:cbe24006683f8eb669266162894b9a522a1af52f2665fbc63a4bb032ed26ac10 https://github.com/FiloSottile/age/releases/download/v1.3.2/age-v1.3.2-linux-amd64.tar.gz /age.tar.gz
RUN tar -xzf /age.tar.gz -C /tmp
FROM restic/restic:0.19.1@sha256:136600b6ff6843d61d355f7f71f460a166429f35de6fd11b568fece3c9a4d510 AS restic
FROM node:22.23.3-bookworm-slim@sha256:43ac6c60b8f89723f746e8a92ce91abd5017e627ce1ddfe4238355d3a30b772c
COPY --from=age /tmp/age/age /tmp/age/age-keygen /usr/local/bin/
COPY --from=restic /usr/bin/restic /usr/local/bin/restic
COPY scripts/backup /opt/scripts/backup
COPY scripts/openbao/recovery-snapshot.mjs scripts/openbao/protected-client.mjs scripts/openbao/recovery-backup.mjs scripts/openbao/recover-custodian.mjs scripts/openbao/finish-recovery.mjs /opt/scripts/openbao/
USER 1000:1000
ENTRYPOINT ["node", "/opt/scripts/backup/main.mjs"]
