const RESERVED = new Set(["policy.override","credential.read","secret.export","production.deploy","branch.main.write","repository.delete"]);

export class AgentRegistry {
  #agents = new Map();
  #tools = new Map();

  registerAgent(agent) {
    if (!agent || typeof agent.id !== "string" || !agent.id ||
        !Array.isArray(agent.scopes) || agent.scopes.some(s => typeof s !== "string" || RESERVED.has(s)) ||
        !["active","disabled"].includes(agent.status)) return {ok:false, reason:"INVALID_AGENT"};
    if (this.#agents.has(agent.id)) return {ok:false, reason:"DUPLICATE_AGENT"};
    this.#agents.set(agent.id,Object.freeze(structuredClone(agent)));
    return {ok:true};
  }

  registerTool(tool) {
    if (!tool || typeof tool.name !== "string" || !tool.name ||
        !Array.isArray(tool.requiredScopes) || tool.requiredScopes.some(s => typeof s !== "string")) {
      return {ok:false, reason:"INVALID_TOOL"};
    }
    if (this.#tools.has(tool.name)) return {ok:false, reason:"DUPLICATE_TOOL"};
    this.#tools.set(tool.name,Object.freeze(structuredClone(tool)));
    return {ok:true};
  }

  authorize(agentId, toolName, resourceScope) {
    const agent = this.#agents.get(agentId), tool = this.#tools.get(toolName);
    if (!agent || agent.status !== "active" || !tool) return {allowed:false, reason:"UNKNOWN_OR_DISABLED"};
    if (RESERVED.has(resourceScope)) return {allowed:false, reason:"RESERVED_SCOPE"};
    const needed = [...tool.requiredScopes, resourceScope];
    if (needed.some(s => !agent.scopes.includes(s))) return {allowed:false, reason:"SCOPE_NOT_GRANTED"};
    return {allowed:true, reason:"SCOPES_MATCH"};
  }
}
