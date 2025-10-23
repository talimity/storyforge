import { RenderError, TemplateStructureError } from "./errors.js";
import { compileLeaf } from "./leaf-compiler.js";
import type {
  AttachmentLaneGroupRuntime,
  AttachmentLaneGroupSpec,
  AttachmentLaneRuntime,
  AttachmentLaneSpec,
  CompiledAttachmentLaneGroupSpec,
  CompiledAttachmentLaneSpec,
  InjectionRequest,
} from "./types.js";

export type AttachmentRuntimeMap = Map<string, AttachmentLaneRuntime>;

/**
 * Build the runtime map of attachment lanes by merging author-defined template
 * specs with runtime defaults. Defaults provide a baseline while template specs
 * take precedence for overlapping fields.
 */
export function buildAttachmentRuntime(
  compiled: readonly CompiledAttachmentLaneSpec[] | undefined,
  defaults: readonly AttachmentLaneSpec[] | undefined
): AttachmentRuntimeMap {
  const lanes: AttachmentRuntimeMap = new Map();

  if (defaults) {
    for (const spec of defaults) {
      lanes.set(spec.id, convertDefaultLane(spec));
    }
  }

  if (compiled) {
    for (const lane of compiled) {
      const base = lanes.get(lane.id);
      lanes.set(lane.id, mergeCompiledLane(lane, base));
    }
  }

  return lanes;
}

function convertDefaultLane(spec: AttachmentLaneSpec): AttachmentLaneRuntime {
  return {
    id: spec.id,
    enabled: spec.enabled !== false,
    role: spec.role,
    template: spec.template ? compileLeaf(spec.template) : undefined,
    order: spec.order ?? 0,
    reserveTokens: spec.reserveTokens,
    budget: spec.budget,
    payload: spec.payload,
    groups: convertOverrideGroups(spec.id, spec.groups),
  };
}

function mergeCompiledLane(
  lane: CompiledAttachmentLaneSpec,
  base: AttachmentLaneRuntime | undefined
): AttachmentLaneRuntime {
  const payload =
    lane.payload !== undefined
      ? base?.payload
        ? { ...base.payload, ...lane.payload }
        : lane.payload
      : base?.payload;

  const groups =
    lane.groups !== undefined ? convertCompiledGroups(lane.id, lane.groups) : base?.groups;

  return {
    id: lane.id,
    enabled: lane.enabled,
    role: lane.role ?? base?.role,
    template: lane.template ?? base?.template,
    order: lane.order ?? base?.order ?? 0,
    reserveTokens: lane.reserveTokens ?? base?.reserveTokens,
    budget: lane.budget ?? base?.budget,
    payload,
    groups,
  };
}

function convertCompiledGroups(
  laneId: string,
  groups: readonly CompiledAttachmentLaneGroupSpec[] | undefined
): readonly AttachmentLaneGroupRuntime[] | undefined {
  if (!groups) return undefined;
  const runtime = groups.map((group) => {
    let regex: RegExp | undefined;
    if (group.match) {
      try {
        regex = new RegExp(group.match);
      } catch {
        throw new TemplateStructureError(
          `Invalid group match regex '${group.match}' in attachment lane '${laneId}'.`
        );
      }
    }

    return Object.freeze({
      id: group.id,
      regex,
      template: group.template,
      openTemplate: group.openTemplate,
      closeTemplate: group.closeTemplate,
      role: group.role,
      order: group.order ?? 0,
      payload: group.payload,
    });
  });

  runtime.sort((a, b) => a.order - b.order);
  return Object.freeze(runtime);
}

function convertOverrideGroups(
  laneId: string,
  groups: readonly AttachmentLaneGroupSpec[] | undefined
): readonly AttachmentLaneGroupRuntime[] | undefined {
  if (!groups) return undefined;
  const runtime = groups.map((group) => {
    let regex: RegExp | undefined;
    if (group.match) {
      try {
        regex = new RegExp(group.match);
      } catch (error) {
        throw new RenderError(
          `Invalid group match regex '${group.match}' in attachment lane default '${laneId}'.`,
          { cause: error instanceof Error ? error : undefined }
        );
      }
    }

    return Object.freeze({
      id: group.id,
      regex,
      template: group.template ? compileLeaf(group.template) : undefined,
      openTemplate: group.openTemplate ? compileLeaf(group.openTemplate) : undefined,
      closeTemplate: group.closeTemplate ? compileLeaf(group.closeTemplate) : undefined,
      role: group.role,
      order: group.order ?? 0,
      payload: group.payload,
    });
  });

  runtime.sort((a, b) => a.order - b.order);
  return Object.freeze(runtime);
}

export function groupInjectionRequestsByLane(
  requests: readonly InjectionRequest[]
): Map<string, readonly InjectionRequest[]> {
  const map = new Map<string, InjectionRequest[]>();
  for (const request of requests) {
    const existing = map.get(request.lane);
    if (existing) existing.push(request);
    else map.set(request.lane, [request]);
  }
  return map;
}
