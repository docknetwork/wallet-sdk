import { useState, useCallback } from "react";
import axios from "axios";
import { createVerificationController } from "@docknetwork/wallet-sdk-core/lib/verification-controller";

/**
 * useImportFlow - Manages import credential modal state and logic
 */
export function useImportFlow(credentialProvider, didProvider, refreshDocuments) {
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [credentialUrl, setCredentialUrl] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importToast, setImportToast] = useState({
    open: false,
    severity: "success",
    message: "",
  });

  const resetImportFlow = useCallback(() => {
    setImportModalOpen(false);
    setCredentialUrl("");
    setIsImporting(false);
  }, []);

  const handleImportCredential = useCallback(async () => {
    if (!credentialProvider) {
      return;
    }

    if (!credentialUrl.startsWith("openid-credential-offer:")) {
      alert("Invalid credential offer URL. Check https://docs.truvera.io/truvera-api/openid#credential-offers for more details.");
      return;
    }

    try {
      setIsImporting(true);

      await credentialProvider.importCredentialFromURI({
        uri: credentialUrl,
        didProvider,
      });

      if (refreshDocuments) {
        await refreshDocuments();
      }

      setImportToast({
        open: true,
        severity: "success",
        message: "Credential imported successfully.",
      });
      
      resetImportFlow();
    } catch (err) {
      console.error("Error importing credential", err);
      setImportToast({
        open: true,
        severity: "error",
        message: `Import failed: ${err?.message || "Unable to import credential."}`,
      });
      setIsImporting(false);
    }
  }, [credentialProvider, didProvider, credentialUrl, refreshDocuments, resetImportFlow]);

  return {
    importModalOpen,
    credentialUrl,
    isImporting,
    importToast,
    // Setters
    setImportModalOpen,
    setCredentialUrl,
    setImportToast,
    // Handlers
    resetImportFlow,
    handleImportCredential,
  };
}

/**
 * useVerifyFlow - Manages verify credential modal state and logic
 */
export function useVerifyFlow(wallet, credentialProvider, didProvider) {
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [proofRequestUrl, setProofRequestUrl] = useState("");
  const [proofRequestTemplate, setProofRequestTemplate] = useState(null);
  const [verifyStep, setVerifyStep] = useState(1);
  const [selectedCredential, setSelectedCredential] = useState(null);
  const [matchingCredentialIds, setMatchingCredentialIds] = useState([]);
  const [loadingMatchingCredentials, setLoadingMatchingCredentials] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyToast, setVerifyToast] = useState({
    open: false,
    severity: "success",
    message: "",
  });

  const resetVerifyFlow = useCallback(() => {
    setVerifyModalOpen(false);
    setVerifyStep(1);
    setProofRequestUrl("");
    setProofRequestTemplate(null);
    setMatchingCredentialIds([]);
    setSelectedCredential(null);
    setIsVerifying(false);
  }, []);

  const handleLoadMatchingCredentials = useCallback(async () => {
    if (!wallet || !credentialProvider || !didProvider || !proofRequestUrl) {
      return;
    }

    try {
      setLoadingMatchingCredentials(true);
      const proofRequest = (await axios.get(proofRequestUrl)).data;
      const controller = createVerificationController({
        wallet,
        credentialProvider,
        didProvider,
      });

      await controller.start({ template: proofRequest });
      const filteredCredentials = controller.getFilteredCredentials() || [];
      const filteredIds = filteredCredentials.map((credential) => credential.id);

      setProofRequestTemplate(proofRequest);
      setMatchingCredentialIds(filteredIds);
      setSelectedCredential(null);
      setVerifyStep(2);
    } catch (err) {
      console.error("Error loading matching credentials", err);
      alert("Unable to load matching credentials for this proof request.");
    } finally {
      setLoadingMatchingCredentials(false);
    }
  }, [wallet, credentialProvider, didProvider, proofRequestUrl]);

  const handleVerifyCredential = useCallback(async () => {
    if (!wallet || !credentialProvider || !didProvider || !selectedCredential) {
      return;
    }

    try {
      setIsVerifying(true);
      const proofRequest = proofRequestTemplate || (await axios.get(proofRequestUrl)).data;
      const controller = createVerificationController({
        wallet,
        credentialProvider,
        didProvider,
      });

      const credential = selectedCredential;

      await controller.start({ template: proofRequest });

      const attributesToReveal = ["credentialSubject.name"];

      controller.selectedCredentials.set(credential.id, {
        credential,
        attributesToReveal,
      });

      const presentation = await controller.createPresentation();

      console.log(presentation);

      const { data: verificationResult } = await axios
        .post(proofRequest.response_url, presentation)
        .then((res) => res.data);

      console.log("Verification sent", {
        verificationResult,
      });

      setVerifyToast({
        open: true,
        severity: "success",
        message: "Verification sent successfully.",
      });
    } catch (err) {
      console.error("Error sending verification", err);

      const errorMessage = err?.response?.data?.error || err?.message || "Unable to verify credential.";
      setVerifyToast({
        open: true,
        severity: "error",
        message: `Verification failed: ${errorMessage}`,
      });
    } finally {
      setIsVerifying(false);
      resetVerifyFlow();
    }
  }, [wallet, credentialProvider, didProvider, selectedCredential, proofRequestTemplate, proofRequestUrl, resetVerifyFlow]);

  return {
    // State
    verifyModalOpen,
    proofRequestUrl,
    proofRequestTemplate,
    verifyStep,
    selectedCredential,
    matchingCredentialIds,
    loadingMatchingCredentials,
    isVerifying,
    verifyToast,
    // Setters
    setVerifyModalOpen,
    setProofRequestUrl,
    setVerifyStep,
    setSelectedCredential,
    setVerifyToast,
    // Handlers
    resetVerifyFlow,
    handleLoadMatchingCredentials,
    handleVerifyCredential,
  };
}
