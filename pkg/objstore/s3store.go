package objstore

import (
	"context"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

type s3Store struct {
	client     *s3.Client
	presigner  *s3.PresignClient
	bucket     string
	publicBase string
	presignTTL time.Duration
}

func NewS3Store(cfg Config) (Store, error) {
	if cfg.Bucket == "" {
		return nil, fmt.Errorf("s3 bucket is required")
	}
	region := strings.TrimSpace(cfg.Region)
	if region == "" {
		region = "us-east-1"
	}
	ttl := cfg.PresignTTL
	if ttl <= 0 {
		ttl = time.Hour
	}
	opts := s3.Options{
		Region:       region,
		Credentials:  aws.NewCredentialsCache(credentials.NewStaticCredentialsProvider(cfg.AccessKey, cfg.SecretKey, "")),
		UsePathStyle: cfg.PathStyle,
	}
	if cfg.HTTPClient != nil {
		opts.HTTPClient = cfg.HTTPClient
	}
	if endpoint := strings.TrimSpace(cfg.Endpoint); endpoint != "" {
		opts.BaseEndpoint = aws.String(endpoint)
	}
	client := s3.New(opts)
	return &s3Store{
		client:     client,
		presigner:  s3.NewPresignClient(client),
		bucket:     cfg.Bucket,
		publicBase: strings.TrimRight(strings.TrimSpace(cfg.PublicBaseURL), "/"),
		presignTTL: ttl,
	}, nil
}

func (s *s3Store) Put(ctx context.Context, key, mime string, r io.Reader, size int64) (string, error) {
	if size < 0 {
		if seeker, ok := r.(io.Seeker); ok {
			end, err := seeker.Seek(0, io.SeekEnd)
			if err != nil {
				return "", err
			}
			if _, err := seeker.Seek(0, io.SeekStart); err != nil {
				return "", err
			}
			size = end
		}
	}
	input := &s3.PutObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
		Body:   r,
	}
	if mime != "" {
		input.ContentType = aws.String(mime)
	}
	if size >= 0 {
		input.ContentLength = aws.Int64(size)
	}
	if _, err := s.client.PutObject(ctx, input); err != nil {
		return "", err
	}
	if s.publicBase != "" {
		return PublicURL(s.publicBase, key), nil
	}
	out, err := s.presigner.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	}, func(o *s3.PresignOptions) {
		o.Expires = s.presignTTL
	})
	if err != nil {
		return "", err
	}
	return out.URL, nil
}

func (s *s3Store) Delete(ctx context.Context, key string) error {
	_, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	return err
}
