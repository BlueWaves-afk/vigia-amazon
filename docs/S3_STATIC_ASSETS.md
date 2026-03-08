# VIGIA Static Assets - S3 Configuration

## S3 Bucket
**Bucket Name**: `vigia-static-assets-1772997117`  
**Region**: `us-east-1`  
**Purpose**: Host large media files (videos, GIFs) for the intro page

## Assets Hosted

### Video
- **File**: `demo.mov` (23 MB)
- **URL**: `https://vigia-static-assets-1772997117.s3.us-east-1.amazonaws.com/intro/demo.mov`
- **Used in**: IntroPage.tsx video modal

## Configuration

### Public Access
- Block Public Access: **Disabled**
- Bucket Policy: **Public read access enabled**

### Bucket Policy
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::vigia-static-assets-1772997117/*"
    }
  ]
}
```

## Why S3 Instead of Git?

**Industry Standard**: Large media files should be hosted on CDN/S3, not in Git repos
- Keeps repository lightweight
- Faster clone/pull operations
- Better performance (S3 is optimized for static assets)
- Scalable (no Git LFS complexity)
- Cost-effective (S3 storage is cheap)

## Uploading New Assets

```bash
# Upload a new file
aws s3 cp <local-file> s3://vigia-static-assets-1772997117/<path> --content-type <mime-type>

# Example: Upload a video
aws s3 cp demo.mov s3://vigia-static-assets-1772997117/intro/demo.mov --content-type video/quicktime

# Example: Upload a GIF
aws s3 cp output.gif s3://vigia-static-assets-1772997117/intro/output.gif --content-type image/gif
```

## Cost Estimate

**Storage**: $0.023 per GB/month
- 23 MB video = ~$0.0005/month

**Data Transfer**: $0.09 per GB (first 10 TB)
- 100 views/day × 23 MB = 2.3 GB/day = ~$6/month

**Total**: ~$6/month (negligible for demo phase)

## Future Enhancements

1. **CloudFront CDN**: Add CloudFront distribution for faster global delivery
2. **Compression**: Use H.264/H.265 encoding to reduce file size
3. **Adaptive Streaming**: Use HLS/DASH for better mobile experience
4. **Lifecycle Policies**: Auto-delete old assets after 90 days

---

**Created**: 2026-03-09  
**Last Updated**: 2026-03-09
