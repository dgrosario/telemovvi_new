interface LegalContactCardProps {
  email: string;
  whatsapp?: string;
  address?: string;
}

export function LegalContactCard({
  email,
  whatsapp,
  address,
}: LegalContactCardProps) {
  return (
    <div className="bg-white border border-[#e1e5e9] rounded-lg p-6 my-5 shadow-sm">
      <h3 className="text-lg font-semibold text-[#2c3e50] mb-4">
        Informações de Contato
      </h3>
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <span className="text-[#065183] font-medium min-w-[100px]">
            Email:
          </span>
          <a
            href={`mailto:${email}`}
            className="text-[#0000FF] hover:underline"
          >
            {email}
          </a>
        </div>
        {whatsapp && (
          <div className="flex items-start gap-3">
            <span className="text-[#065183] font-medium min-w-[100px]">
              WhatsApp:
            </span>
            <span className="text-[#495057]">{whatsapp}</span>
          </div>
        )}
        {address && (
          <div className="flex items-start gap-3">
            <span className="text-[#065183] font-medium min-w-[100px]">
              Endereço:
            </span>
            <span className="text-[#495057]">{address}</span>
          </div>
        )}
      </div>
    </div>
  );
}
