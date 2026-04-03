import React, { useState, useEffect, useRef } from 'react';
import {
  Container, Grid, Card, CardContent, CardActions, Typography, Box, Chip,
  CircularProgress, Button, Alert, IconButton, Tooltip, Dialog,
  DialogTitle, DialogContent, DialogActions, Divider
} from '@mui/material';
import {
  CloudUpload as UploadIcon, Visibility as ViewIcon,
  CheckCircle as ApprovedIcon, Schedule as PendingIcon,
  Error as RejectedIcon, Description as DocIcon,
  InsertDriveFile as FileIcon, CameraAlt as CameraIcon,
  VerifiedUser as DigiLockerIcon
} from '@mui/icons-material';
import axios from 'axios';
import { toast } from 'react-toastify';

const DOC_TYPES = [
  { key: 'aadhaar_card', label: 'Aadhaar Card (Front & Back)', required: true, maxSizeKB: 500 },
  { key: 'pan_card', label: 'PAN Card', required: true, maxSizeKB: 200 },
  { key: 'cancelled_cheque', label: 'Cancelled Cheque / Bank Proof', required: true, maxSizeKB: 400 },
  { key: 'selfie_photo', label: 'Live Selfie Photo', required: true, maxSizeKB: 150 },
];

const statusConfig = {
  approved: { color: 'success', icon: <ApprovedIcon fontSize="small" /> },
  verified: { color: 'success', icon: <ApprovedIcon fontSize="small" /> },
  pending: { color: 'warning', icon: <PendingIcon fontSize="small" /> },
  rejected: { color: 'error', icon: <RejectedIcon fontSize="small" /> },
};
const isDocApproved = (doc) => doc?.verification_status === 'approved' || doc?.verification_status === 'verified';

const Documents = () => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);
  const fileInputRef = useRef();
  const cameraInputRef = useRef();
  const [pendingDocType, setPendingDocType] = useState(null);
  const [dlStatus, setDlStatus] = useState(null);
  const [dlLoading, setDlLoading] = useState(false);
  const [localPreviews, setLocalPreviews] = useState({});

  useEffect(() => { fetchDocuments(); fetchDlStatus(); }, []);

  const fetchDlStatus = async () => {
    try {
      const res = await axios.get('/digilocker/status');
      if (res.data.success) setDlStatus(res.data.data);
    } catch {}
  };

  const handleDigiLocker = async () => {
    setDlLoading(true);
    try {
      const res = await axios.get('/digilocker/auth-url');
      if (res.data.success && res.data.data.authUrl) {
        window.location.href = res.data.data.authUrl;
      } else {
        toast.error(res.data.message || 'DigiLocker not available');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'DigiLocker not configured');
    } finally {
      setDlLoading(false);
    }
  };

  const fetchDocuments = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get('/documents');
      if (res.data.success) setDocuments(res.data.data || []);
    } catch (err) {
      setError('Could not load documents.');
    } finally {
      setLoading(false);
    }
  };

  const getDoc = (key) => documents.find(d => d.document_type === key);

  const triggerUpload = (docType) => {
    setPendingDocType(docType);
    fileInputRef.current.click();
  };

  const triggerCamera = (docType) => {
    setPendingDocType(docType);
    cameraInputRef.current.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file || !pendingDocType) return;
    e.target.value = '';

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only JPG, JPEG and PNG files are allowed.');
      return;
    }
    const docConfig = DOC_TYPES.find(d => d.key === pendingDocType);
    const maxSizeKB = docConfig?.maxSizeKB || 500;
    if (file.size > maxSizeKB * 1024) {
      toast.error(`File size must be under ${maxSizeKB} KB for ${docConfig?.label || pendingDocType}.`);
      return;
    }

    // Show immediate local preview
    const localUrl = URL.createObjectURL(file);
    setLocalPreviews(prev => ({ ...prev, [pendingDocType]: localUrl }));

    setUploading(pendingDocType);
    try {
      const form = new FormData();
      form.append('document', file);
      form.append('document_type', pendingDocType);
      const res = await axios.post('/documents/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data.success) {
        toast.success('Document uploaded successfully!');
        fetchDocuments();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed.');
      // Remove local preview on failure
      setLocalPreviews(prev => { const n = { ...prev }; delete n[pendingDocType]; return n; });
    } finally {
      setUploading(null);
      setPendingDocType(null);
    }
  };

  const required = DOC_TYPES;
  const approvedRequired = required.filter(d => isDocApproved(getDoc(d.key))).length;

  if (loading) return <Box display="flex" justifyContent="center" mt={8}><CircularProgress /></Box>;

  return (
    <Container maxWidth="lg" sx={{ py: 2 }}>
      {/* Hidden file input for gallery upload */}
      <input type="file" ref={fileInputRef} style={{ display: 'none' }}
        accept=".jpg,.jpeg,.png" onChange={handleFileChange} />
      {/* Hidden file input for camera capture */}
      <input type="file" ref={cameraInputRef} style={{ display: 'none' }}
        accept="image/jpeg,image/png" capture="environment" onChange={handleFileChange} />

      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h4">My Documents</Typography>
        <Chip
          label={`${approvedRequired}/${required.length} Required KYC Docs`}
          color={approvedRequired === required.length ? 'success' : 'warning'}
          icon={approvedRequired === required.length ? <ApprovedIcon /> : <PendingIcon />}
        />
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {approvedRequired < required.length && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Upload all required documents to complete KYC verification.
        </Alert>
      )}

      {/* DigiLocker Integration */}
      <Card sx={{ mb: 3, borderRadius: 3, border: dlStatus?.connected ? '1px solid #4caf50' : '1px solid #1976d2' }}>
        <CardContent>
          <Box display="flex" alignItems="center" gap={2}>
            <DigiLockerIcon sx={{ fontSize: 40, color: dlStatus?.connected ? '#4caf50' : '#1976d2' }} />
            <Box flex={1}>
              <Typography variant="h6">DigiLocker eKYC</Typography>
              <Typography variant="body2" color="text.secondary">
                {dlStatus?.connected
                  ? `Connected — DigiLocker ID: ${dlStatus.digilocker_id}`
                  : 'Connect your DigiLocker to auto-verify Aadhaar & PAN instantly'}
              </Typography>
            </Box>
            <Button
              variant={dlStatus?.connected ? 'outlined' : 'contained'}
              color={dlStatus?.connected ? 'success' : 'primary'}
              startIcon={dlLoading ? <CircularProgress size={16} /> : <DigiLockerIcon />}
              onClick={handleDigiLocker}
              disabled={dlLoading || dlStatus?.connected}
            >
              {dlStatus?.connected ? 'Connected' : 'Connect DigiLocker'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      <Typography variant="h6" sx={{ mb: 2, color: 'text.secondary' }}>Required Documents (JPG/JPEG/PNG only)</Typography>
      <Grid container spacing={2} mb={4}>
        {required.map(docType => {
          const doc = getDoc(docType.key);
          const vs = doc?.verification_status;
          const cfg = vs ? statusConfig[vs] : null;
          const isUploading = uploading === docType.key;
          return (
            <Grid item xs={12} sm={6} md={6} key={docType.key}>
              <Card sx={{ borderRadius: 3, border: isDocApproved(doc) ? '1px solid #4caf50' : '1px solid #e0e0e0', height: '100%' }}>
                <CardContent>
                  <Box display="flex" alignItems="center" gap={1} mb={1}>
                    <DocIcon color={doc ? 'primary' : 'disabled'} />
                    <Typography variant="body1" fontWeight={600}>{docType.label}</Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                    Max size: {docType.maxSizeKB} KB
                  </Typography>
                  {doc ? (
                    <Chip size="small" label={vs} color={cfg?.color || 'default'} icon={cfg?.icon}
                      sx={{ textTransform: 'capitalize', mb: 1 }} />
                  ) : (
                    <Chip size="small" label="Not uploaded" color="default" sx={{ mb: 1 }} />
                  )}
                  {vs === 'rejected' && (doc.notes || doc.rejection_reason) && (
                    <Alert severity="error" sx={{ py: 0, fontSize: 11, mt: 1 }}>{doc.notes || doc.rejection_reason}</Alert>
                  )}
                  {(doc?.file_url || localPreviews[docType.key]) && (
                    <Box
                      component="img" src={localPreviews[docType.key] || doc.file_url} alt={docType.label}
                      onClick={() => setPreviewDoc({ ...doc, _previewUrl: localPreviews[docType.key] || doc?.file_url })}
                      sx={{ width: '100%', maxHeight: 140, objectFit: 'cover', borderRadius: 1, mt: 1, cursor: 'pointer', border: '1px solid #e0e0e0' }}
                    />
                  )}
                </CardContent>
                <CardActions>
                  {(doc || localPreviews[docType.key]) && (
                    <Tooltip title="Preview"><IconButton size="small" onClick={() => setPreviewDoc({ ...doc, _previewUrl: localPreviews[docType.key] || doc?.file_url })}><ViewIcon /></IconButton></Tooltip>
                  )}
                  {docType.key === 'selfie_photo' ? (
                    <Button size="small" startIcon={isUploading ? <CircularProgress size={14} /> : <CameraIcon />}
                      onClick={() => triggerCamera(docType.key)} disabled={!!uploading || isDocApproved(doc)}>
                      {doc ? (isDocApproved(doc) ? 'Approved' : 'Retake Selfie') : 'Take Selfie'}
                    </Button>
                  ) : (
                    <>
                      <Button size="small" startIcon={isUploading ? <CircularProgress size={14} /> : <CameraIcon />}
                        onClick={() => triggerCamera(docType.key)} disabled={!!uploading || isDocApproved(doc)}>
                        Camera
                      </Button>
                      <Button size="small" startIcon={isUploading ? <CircularProgress size={14} /> : <UploadIcon />}
                        onClick={() => triggerUpload(docType.key)} disabled={!!uploading || isDocApproved(doc)}>
                        {doc ? (isDocApproved(doc) ? 'Approved' : 'Re-upload') : 'Upload'}
                      </Button>
                    </>
                  )}
                </CardActions>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Preview Dialog */}
      <Dialog open={!!previewDoc} onClose={() => setPreviewDoc(null)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ textTransform: 'capitalize' }}>{previewDoc?.document_type?.replace(/_/g, ' ') || 'Document Preview'}</DialogTitle>
        <DialogContent>
          {previewDoc?.mime_type === 'application/pdf'
            ? <iframe src={previewDoc._previewUrl || previewDoc?.file_url} title="doc" width="100%" height="500px" style={{ border: 'none' }} />
            : <Box component="img" src={previewDoc?._previewUrl || previewDoc?.file_url} alt="document"
                sx={{ width: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: 2 }} />
          }
          <Divider sx={{ my: 1 }} />
          <Typography variant="caption" color="text.secondary">
            Uploaded: {previewDoc?.created_at ? new Date(previewDoc.created_at).toLocaleDateString('en-IN') : '—'}
            {previewDoc?.file_size ? ` • Size: ${(previewDoc.file_size / 1024).toFixed(1)} KB` : ''}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewDoc(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Documents;

