export interface JsonMapperWidgetProps {
  partnerName: string;
  eventName: string;
  version: string;
  mappedFields: number;
  status: 'draft' | 'ready' | 'attention';
  onOpen?(): void;
}
