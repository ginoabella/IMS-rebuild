import type {
  ExtensionBulkPreviewDto,
  ExtensionDto,
  EndpointProfileDto,
} from '@myims/contracts';
export type InventoryAttempt = {
  operatorId: string;
  workflowId: string;
  parts: string[];
  method: 'POST' | 'PATCH';
  body: Record<string, unknown>;
};
export type InventoryWork = {
  nodeId: string;
  workflowId: string;
  values: Record<
    | 'number'
    | 'numbers'
    | 'rangeStart'
    | 'rangeEnd'
    | 'bulkMode'
    | 'kind'
    | 'profileId'
    | 'name'
    | 'template'
    | 'codecs'
    | 'maxContacts',
    string
  >;
  preview: ExtensionBulkPreviewDto | null;
  extension: ExtensionDto | null;
  profile: EndpointProfileDto | null;
  attempt: InventoryAttempt | null;
  needsReview: boolean;
};
export const emptyInventory = (): InventoryWork => ({
  nodeId: '',
  workflowId: '',
  values: {
    number: '',
    numbers: '',
    rangeStart: '',
    rangeEnd: '',
    bulkMode: 'list',
    kind: 'sip',
    profileId: '',
    name: '',
    template: 'sip-basic',
    codecs: 'ulaw,alaw',
    maxContacts: '1',
  },
  preview: null,
  extension: null,
  profile: null,
  attempt: null,
  needsReview: false,
});
