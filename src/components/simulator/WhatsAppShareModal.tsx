/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { db } from '../../db/sqlite-simulation.ts';
import { ShareDispatchModal } from './ShareDispatchModal.tsx';

interface WhatsAppShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  messageText: string;
  targetPhone?: string;
  storeId?: number;
  customerId?: number | null;
  customerName?: string;
  reference?: string;
}

export const WhatsAppShareModal: React.FC<WhatsAppShareModalProps> = ({
  isOpen,
  onClose,
  title,
  messageText,
  targetPhone,
  storeId,
  customerId,
  customerName,
  reference,
}) => {
  const activeStoreId = storeId ?? db.getSharedPreferences().store_id ?? 1;
  return (
    <ShareDispatchModal
      isOpen={isOpen}
      onClose={onClose}
      storeId={activeStoreId}
      customerId={customerId}
      customerName={customerName}
      targetPhone={targetPhone}
      title={title}
      messageText={messageText}
      reference={reference}
    />
  );
};
