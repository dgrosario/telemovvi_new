"use client";

import { retrievePartner } from "@/app/actions/partners";
import { useServerActionQuery } from "@/hooks/server-action-hooks";
import { useContactDetails } from "@/hooks/use-contact-details";
import { useChat } from "@/hooks/use-chat";
import { useCanViewContactDetails } from "@/hooks/use-permission-check";
import { useEffect, useCallback, useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ContactDetailsHeader,
  ContactDetailsProfile,
} from "./contact-details-header";
import { ContactDetailsForm } from "./contact-details-form";
import { ContactDetailsRestricted } from "./contact-details-restricted";
import { MediaGallery } from "./media-gallery";
import { StarredMessagesGallery } from "./starred-messages-gallery";
import { CircularProgress } from "@mui/material";
import { getInstagramHandleForDisplay } from "@/utils/instagram-contact";

export function ContactDetailsDrawer() {
  const {
    open,
    contactId,
    channelId,
    conversationId,
    sectorId,
    closeContactDetails,
  } = useContactDetails();
  const setScrollToMessageId = useChat((state) => state.setScrollToMessageId);
  const canViewContactDetails = useCanViewContactDetails(sectorId);

  const partnerQuery = useServerActionQuery(retrievePartner, {
    input: { id: contactId ?? "", sectorId: sectorId },
    enabled: Boolean(contactId),
    queryKey: ["contact-details-partner", contactId, sectorId],
  });

  useEffect(() => {
    if (partnerQuery.data) {
      console.log(
        "[ContactDetailsDrawer] Partner loaded, contacts:",
        partnerQuery.data.contacts.length,
        partnerQuery.data.contacts.map((c) => ({
          type: c.type,
          value: c.value,
        })),
      );
    }
  }, [partnerQuery.data]);

  useEffect(() => {
    if (contactId) {
      partnerQuery.refetch();
    }
  }, [contactId]);

  const partnerData = useMemo(() => {
    if (!partnerQuery.data) return null;
    if (!contactId) return partnerQuery.data;

    const contactIndex = partnerQuery.data.contacts.findIndex(
      (contact) => contact.id === contactId,
    );

    if (contactIndex <= 0) {
      return partnerQuery.data;
    }

    const contacts = [...partnerQuery.data.contacts];
    const [primaryContact] = contacts.splice(contactIndex, 1);
    contacts.unshift(primaryContact);

    return {
      ...partnerQuery.data,
      contacts,
    };
  }, [partnerQuery.data, contactId]);

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      closeContactDetails();
    }
  };

  const handleStarredMessageClick = useCallback(
    (messageId: string) => {
      setScrollToMessageId(messageId);
      closeContactDetails();
    },
    [setScrollToMessageId, closeContactDetails],
  );
  const primaryContact = partnerData?.contacts[0];
  const primaryContactDisplayValue =
    primaryContact?.type === "instagram"
      ? getInstagramHandleForDisplay(primaryContact)
      : primaryContact?.value;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange} modal={false}>
      <SheetContent
        side="right"
        className="w-full sm:w-[440px] sm:max-w-[440px] p-0 flex flex-col max-h-[100dvh]"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Detalhes do Contato</SheetTitle>
        </SheetHeader>

        {partnerQuery.isPending ? (
          <div className="flex-1 flex items-center justify-center">
            <CircularProgress size={28} />
          </div>
        ) : partnerData ? (
          <div className="flex flex-col h-full">
            <ContactDetailsHeader
              name={partnerData.name}
              thumbnail={partnerData.contacts[0]?.thumbnail}
              value={
                canViewContactDetails ? primaryContactDisplayValue : undefined
              }
              onClose={closeContactDetails}
            />

            <div className="flex-1 overflow-y-auto bg-white">
              <ContactDetailsProfile
                name={partnerData.name}
                thumbnail={partnerData.contacts[0]?.thumbnail}
                value={
                  canViewContactDetails ? primaryContactDisplayValue : undefined
                }
              />

              <Tabs defaultValue="details" className="flex flex-col">
                <TabsList
                  variant="line"
                  className="px-4 shrink-0 border-b gap-4 bg-white sticky top-0 z-[1]"
                >
                  <TabsTrigger value="details">Detalhes</TabsTrigger>
                  <TabsTrigger value="media">Mídia</TabsTrigger>
                  <TabsTrigger value="starred">Favoritas</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="p-4">
                  {canViewContactDetails ? (
                    <ContactDetailsForm
                      partner={partnerData}
                      onSuccess={() => partnerQuery.refetch()}
                    />
                  ) : (
                    <ContactDetailsRestricted
                      partner={partnerData}
                      onSuccess={() => partnerQuery.refetch()}
                    />
                  )}
                </TabsContent>

                <TabsContent value="media" className="p-4">
                  {contactId && channelId && (
                    <MediaGallery contactId={contactId} channelId={channelId} />
                  )}
                </TabsContent>

                <TabsContent value="starred" className="p-4">
                  {conversationId && (
                    <StarredMessagesGallery
                      conversationId={conversationId}
                      onMessageClick={handleStarredMessageClick}
                    />
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            Contato não encontrado
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
