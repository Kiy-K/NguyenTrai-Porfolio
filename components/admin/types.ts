export interface AdminStatus {
  type: 'success' | 'error' | 'loading' | null;
  message: string;
}

export interface UploadedMuxVideo {
  muxAssetId: string;
  muxPlaybackId: string;
}

export interface MutationState {
  isMutationPending: boolean;
  setIsMutationPending: (pending: boolean) => void;
}
