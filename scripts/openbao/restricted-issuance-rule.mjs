// Pure HCL generation for the exact reviewed native token-role request.
export function restrictedIssuanceRule(role) {
  const parameters = Object.keys(role.request);
  // OpenBao 2.7.1 compares the complete JSON array against each allowed value.
  // Wrap arrays too; flattening policies would reject the normal request.
  return `path "auth/token/create/${role.name}" {
  capabilities = ["update"]
  required_parameters = ${JSON.stringify(parameters)}
  allowed_parameters = {
${parameters.map((key) => `    ${JSON.stringify(key)} = ${JSON.stringify([role.request[key]])}`).join('\n')}
  }
}`;
}
