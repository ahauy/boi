import React from "react";
import { TarotCorners } from "@/components/mystic/MysticDivider";

interface DeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
}

export const DeleteModal: React.FC<DeleteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isDeleting,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      data-testid="delete-modal"
    >
      <div className="relative w-full max-w-[420px] mystic-card p-6 sm:p-7 rounded-2xl text-ink">
        <TarotCorners />
        <h3 className="font-display text-2xl font-bold text-[#f7e7b4] mb-2">
          Xác nhận xoá
        </h3>
        <p className="text-sm sm:text-base text-body mb-6 leading-relaxed">
          Bạn có chắc chắn muốn xoá lần xem bói này? Sau khi xoá, kết quả sẽ không thể khôi phục.
        </p>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="btn-secondary !min-h-[38px] !px-5 text-sm"
            data-testid="cancel-delete-button"
          >
            Huỷ
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-5 py-2 bg-danger text-[#0b0716] font-bold text-sm rounded-full hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
            data-testid="confirm-delete-button"
          >
            {isDeleting ? "Đang xoá..." : "Xoá vĩnh viễn"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteModal;
