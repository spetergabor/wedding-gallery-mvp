import {
  PROOFING_STATUS_DELIVERED,
  PROOFING_STATUS_PROCESSING,
  PROOFING_STATUS_SUBMITTED
} from "@/lib/proofing";

export const MINI_SESSION_WORKFLOW_SHOOT_SCHEDULED = "shoot_scheduled";
export const MINI_SESSION_WORKFLOW_RAW_UPLOAD = "raw_upload";
export const MINI_SESSION_WORKFLOW_CLIENT_SELECTION = "client_selection";
export const MINI_SESSION_WORKFLOW_FINAL_UPLOAD = "final_upload";
export const MINI_SESSION_WORKFLOW_DELIVERED = "delivered";

export const MINI_SESSION_WORKFLOW_STAGES = [
  {
    key: MINI_SESSION_WORKFLOW_SHOOT_SCHEDULED,
    shortLabel: "Fotózás",
    label: "Fotózás",
    description: "A lefoglalt fotózás még nem lett lezárva."
  },
  {
    key: MINI_SESSION_WORKFLOW_RAW_UPLOAD,
    shortLabel: "Válogatás",
    label: "Válogatás előkészítése",
    description: "Töltsd fel a nyers előnézeteket, majd küldd ki a válogató linket."
  },
  {
    key: MINI_SESSION_WORKFLOW_CLIENT_SELECTION,
    shortLabel: "Ügyfélre vár",
    label: "Ügyfél válogat",
    description: "A válogató link kiment, most az ügyfél végleges választására várunk."
  },
  {
    key: MINI_SESSION_WORKFLOW_FINAL_UPLOAD,
    shortLabel: "Kész képek",
    label: "Kész képek átadása",
    description: "A válogatás lezárult. A kidolgozott képek külön végleges galériába kerülnek."
  },
  {
    key: MINI_SESSION_WORKFLOW_DELIVERED,
    shortLabel: "Átadva",
    label: "Galéria átadva",
    description: "A kész galéria elérhető az ügyfélnek."
  }
] as const;

export type MiniSessionWorkflowStage = (typeof MINI_SESSION_WORKFLOW_STAGES)[number]["key"];

type WorkflowSource = {
  workflowStatus?: string | null;
  shootCompletedAt?: Date | null;
  selectionSentAt?: Date | null;
  selectionSubmittedAt?: Date | null;
  finalDeliveredAt?: Date | null;
  proofingGallery?: {
    proofingInviteSentAt?: Date | null;
    proofingStatus?: string | null;
  } | null;
  finalGallery?: {
    finalDeliveryEmailSentAt?: Date | null;
  } | null;
};

export function deriveMiniSessionWorkflowStage(source: WorkflowSource): MiniSessionWorkflowStage {
  if (
    source.finalDeliveredAt ||
    source.finalGallery?.finalDeliveryEmailSentAt ||
    source.workflowStatus === MINI_SESSION_WORKFLOW_DELIVERED
  ) {
    return MINI_SESSION_WORKFLOW_DELIVERED;
  }

  if (
    source.selectionSubmittedAt ||
    [PROOFING_STATUS_SUBMITTED, PROOFING_STATUS_PROCESSING, PROOFING_STATUS_DELIVERED].includes(
      source.proofingGallery?.proofingStatus ?? ""
    ) ||
    source.workflowStatus === MINI_SESSION_WORKFLOW_FINAL_UPLOAD
  ) {
    return MINI_SESSION_WORKFLOW_FINAL_UPLOAD;
  }

  if (
    source.selectionSentAt ||
    source.proofingGallery?.proofingInviteSentAt ||
    source.workflowStatus === MINI_SESSION_WORKFLOW_CLIENT_SELECTION
  ) {
    return MINI_SESSION_WORKFLOW_CLIENT_SELECTION;
  }

  if (
    source.shootCompletedAt ||
    source.proofingGallery ||
    source.workflowStatus === MINI_SESSION_WORKFLOW_RAW_UPLOAD
  ) {
    return MINI_SESSION_WORKFLOW_RAW_UPLOAD;
  }

  return MINI_SESSION_WORKFLOW_SHOOT_SCHEDULED;
}

export function miniSessionWorkflowStageIndex(stage: MiniSessionWorkflowStage) {
  return MINI_SESSION_WORKFLOW_STAGES.findIndex((item) => item.key === stage);
}

export function miniSessionWorkflowStageLabel(stage: MiniSessionWorkflowStage) {
  return MINI_SESSION_WORKFLOW_STAGES.find((item) => item.key === stage)?.label ?? "Fotózás";
}
