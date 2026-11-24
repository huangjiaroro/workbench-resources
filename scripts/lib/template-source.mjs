// Compile authoring sources into the same templates for publication and release checks.
export function employeeTemplate(employee, skills, resolve) {
  return {
    kind: "employee",
    id: employee.id,
    version: employee.version,
    versionSemantics: "declared-semver-v1",
    name: employee.name,
    description: employee.description,
    avatar: employee.avatar,
    instructions: employee.instructions,
    playbook: employee.playbook,
    skills: skills.map((id) => resolve("skill", id)),
  };
}
export function organizationTemplate(pack, employees, resolve) {
  return {
    kind: "organization",
    id: pack.id,
    version: pack.version,
    versionSemantics: "declared-semver-v1",
    name: pack.name,
    description: "",
    workMode: pack.workMode,
    leaderRole: "leader",
    playbook: pack.playbook,
    artifactContract: pack.artifactContract,
    roles: pack.employees.map((role) => ({
      role: role.role,
      name: role.name,
      description: "",
      instructions: role.roleInstructions,
      canDelegate: role.canDelegate ?? false,
      employee: resolve("employee", employees.get(role.role).id),
    })),
    plugins: (pack.plugins ?? []).map(({ id }) => resolve("plugin", id)),
  };
}
